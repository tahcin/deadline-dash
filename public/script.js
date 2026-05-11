/* =====================================================================
   DEADLINE DASH — runtime
   ===================================================================== */

const SECTION_BY_CATEGORY = {
    cla: 'cla',
    midterm: 'cla',
    assignment: 'assignment',
    liveSession: 'liveSession',
    other: 'assignment',
};
const SECTION_IDS = ['cla', 'assignment', 'liveSession'];
const GRACE_MS = 24 * 60 * 60 * 1000;
const URGENT_MS = 24 * 60 * 60 * 1000;          // <24h => urgent
const WARNING_MS = 72 * 60 * 60 * 1000;         // <72h => warning

/* ----- helpers ----- */

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function formatCountdown(ms) {
    if (ms <= 0) return 'EXPIRED';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
    return `${seconds}s`;
}

function formatRoughTime(ms) {
    if (ms <= 0) return 'now';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''}`;
}

function urgencyFor(dueMs, now) {
    const remaining = dueMs - now;
    if (remaining <= 0) return 'expired';
    if (remaining < URGENT_MS) return 'urgent';
    if (remaining < WARNING_MS) return 'warning';
    return 'ok';
}

const COURSE_TAG_RE = /course-v1:[^+]+\+([A-Za-z0-9]+)\+/;
function extractCourseTag(courseId) {
    const m = COURSE_TAG_RE.exec(courseId || '');
    return m ? m[1].toUpperCase() : '';
}

function normalizeAssessmentTitle(deadline) {
    const sec = SECTION_BY_CATEGORY[deadline.category] || 'assignment';
    if (sec !== 'cla') return deadline.title;
    const t = String(deadline.title || '');
    const isMidTerm = deadline.category === 'midterm' || /mid[\s-]*term/i.test(t);
    const label = isMidTerm ? 'Mid-Term' : 'CLA';
    const moduleMatch = t.match(/^\s*(\d+)\.\d+/) || t.match(/module\s+(\d+)/i);
    return moduleMatch ? `Module ${moduleMatch[1]} ${label}` : label;
}

function formatDueLabel(iso) {
    try {
        const dt = new Date(iso);
        const formatted = dt.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'short', day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit', hour12: true
        }).replace(',', ' ·');
        return formatted.replace(/\b(am|pm)\b/g, m => m.toUpperCase()) + ' IST';
    } catch (e) {
        return '';
    }
}

function formatTodayDate() {
    return new Date().toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
}

function shouldShow(d, now) {
    if (d.complete) return false;
    if (!d.learnerHasAccess) return false;
    if (d.courseArchived) return false;
    const due = new Date(d.dueAt).getTime();
    if (!Number.isFinite(due)) return false;
    if (now > due + GRACE_MS) return false;
    return true;
}

/* ----- data ----- */

async function loadDeadlines() {
    try {
        const res = await fetch('/deadlines.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error('failed to load deadlines.json', e);
        return { deadlines: [] };
    }
}

/* ----- render ----- */

let currentFilter = 'all';
let allVisibleDeadlines = [];


function renderRow(deadline, index) {
    const due = new Date(deadline.dueAt).getTime();
    const urgency = urgencyFor(due, Date.now());
    const tag = extractCourseTag(deadline.courseId);
    const section = SECTION_BY_CATEGORY[deadline.category] || 'assignment';
    const li = document.createElement('li');
    li.className = 'row';
    li.dataset.urgency = urgency;
    li.dataset.link = deadline.link || '';
    li.dataset.category = section;
    li.style.setProperty('--i', index);
    const displayTitle = section === 'cla' ? normalizeAssessmentTitle(deadline) : deadline.title;
    const bodyHtml = section === 'assignment'
        ? `<span class="row-title">${escapeHtml(deadline.courseName)}</span>`
        : `<span class="row-title">${escapeHtml(displayTitle)}</span>
           <span class="row-course">${escapeHtml(deadline.courseName)}</span>`;
    li.innerHTML = `
        <span class="row-tag">${escapeHtml(tag)}</span>
        <div class="row-body">
            ${bodyHtml}
        </div>
        <div class="row-time">
            <span class="row-countdown" data-due="${due}"></span>
            <span class="row-due">${escapeHtml(formatDueLabel(deadline.dueAt))}</span>
        </div>
    `;
    if (deadline.link) {
        li.classList.add('row--clickable');
        li.addEventListener('click', () => window.open(deadline.link, '_blank', 'noopener'));
    }
    return li;
}

function renderGroups(deadlines) {
    const grouped = { cla: [], assignment: [], liveSession: [] };
    for (const d of deadlines) {
        const sec = SECTION_BY_CATEGORY[d.category] || 'assignment';
        grouped[sec].push(d);
    }

    const labels = {
        cla: 'CLAs & Mid-Terms',
        assignment: 'Projects',
        liveSession: 'Live Sessions',
    };

    let globalIndex = 0;
    for (const sec of SECTION_IDS) {
        const list = document.getElementById('rows' + sec.charAt(0).toUpperCase() + sec.slice(1));
        if (!list) continue;
        list.innerHTML = '';
        if (grouped[sec].length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty-state';
            empty.textContent = `No Upcoming ${labels[sec]}.`;
            list.appendChild(empty);
        } else {
            for (const d of grouped[sec]) {
                list.appendChild(renderRow(d, globalIndex++));
            }
        }
    }

    document.querySelectorAll('[data-count-for]').forEach(el => {
        const target = el.dataset.countFor;
        const count = target === 'all' ? deadlines.length : (grouped[target] ? grouped[target].length : 0);
        if (el.classList.contains('group-count')) {
            el.textContent = count === 0 ? 'None Active' : `${count} Active`;
        } else {
            el.textContent = count;
        }
    });

    const totalEl = document.getElementById('totalCount');
    if (totalEl) totalEl.textContent = deadlines.length === 0 ? 'All Clear' : `${deadlines.length} Active`;
}

function applyFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('is-active', chip.dataset.filter === filter);
    });
    document.querySelectorAll('.group').forEach(g => {
        g.hidden = filter !== 'all' && g.dataset.category !== filter;
    });
}

function renderAll(data) {
    const now = Date.now();
    const visible = (data.deadlines || [])
        .filter(d => shouldShow(d, now))
        .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

    allVisibleDeadlines = visible;

    renderGroups(visible);
    renderCalendar(visible);

    tickAll();
}

function renderCalendar(deadlines) {
    const cal = document.getElementById('calendar');
    if (!cal) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastOfMonth.getDate();

    let firstCol = firstOfMonth.getDay() - 1;
    if (firstCol < 0) firstCol = 6;

    const byDate = {};
    for (const d of deadlines) {
        const dt = new Date(d.dueAt);
        const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(d);
    }

    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const monthName = firstOfMonth.toLocaleDateString('en-IN', { month: 'long' });

    let html = `
        <header class="calendar-head">
            <h3>${monthName}</h3>
            <span class="cal-year">${year}</span>
        </header>
        <div class="calendar-weekdays">
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
        <div class="calendar-grid">
    `;

    for (let i = 0; i < firstCol; i++) {
        html += '<span class="cal-cell cal-empty"></span>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const key = `${year}-${pad(month + 1)}-${pad(day)}`;
        const dayDeadlines = byDate[key] || [];
        const isToday = key === todayKey;
        let urgency = '';
        let dot = '';
        if (dayDeadlines.length) {
            const earliest = Math.min(...dayDeadlines.map(d => new Date(d.dueAt).getTime()));
            const ms = earliest - Date.now();
            if (ms < URGENT_MS) urgency = 'urgent';
            else if (ms < WARNING_MS) urgency = 'warning';
            else urgency = 'ok';
            dot = '<span class="cal-dot"></span>';
        }
        const classes = ['cal-cell'];
        if (isToday) classes.push('is-today');
        if (dayDeadlines.length) classes.push('has-deadline');
        const urgAttr = urgency ? ` data-urgency="${urgency}"` : '';
        const titleAttr = dayDeadlines.length
            ? ` title="${dayDeadlines.length} deadline${dayDeadlines.length !== 1 ? 's' : ''}"`
            : '';
        html += `<span class="${classes.join(' ')}"${urgAttr}${titleAttr}>${day}${dot}</span>`;
    }

    html += `</div>
        <ul class="calendar-legend">
            <li><span class="legend-dot urgent"></span>&lt;24h</li>
            <li><span class="legend-dot warning"></span>&lt;72h</li>
            <li><span class="legend-dot ok"></span>later</li>
        </ul>
    `;

    cal.innerHTML = html;
}

/* ----- tick ----- */

function tickAll() {
    const now = Date.now();
    let removedAny = false;

    document.querySelectorAll('[data-due]').forEach(el => {
        const due = parseInt(el.dataset.due, 10);
        if (!Number.isFinite(due)) return;

        if (now > due + GRACE_MS) {
            const row = el.closest('.row');
            if (row) { row.remove(); removedAny = true; }
            return;
        }

        const remaining = due - now;
        const isExpired = remaining <= 0;
        const isRough = el.dataset.format === 'rough';
        let text;
        if (isExpired) text = 'Expired';
        else if (isRough) text = formatRoughTime(remaining);
        else text = formatCountdown(remaining);
        if (el.textContent !== text) el.textContent = text;
        el.classList.toggle('expired', isExpired);

        const row = el.closest('.row');
        if (row) row.dataset.urgency = isExpired ? 'expired' : urgencyFor(due, now);
    });

    if (removedAny) {
        renderAll({ deadlines: allVisibleDeadlines });
    }
}

/* ----- dark mode ----- */

function initDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const saved = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enabled = saved ? saved === 'enabled' : prefersDark;
    document.body.classList.toggle('dark-mode', enabled);
    if (toggle) toggle.textContent = enabled ? '◑' : '◐';
    if (toggle) toggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
        toggle.textContent = isDark ? '◑' : '◐';
    });
}

/* ----- install button ----- */

let deferredPrompt = null;

function initInstallButton() {
    const btn = document.getElementById('installButton');
    if (!btn) return;
    if (window.matchMedia('(display-mode: standalone)').matches) {
        btn.hidden = true;
        return;
    }
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        btn.hidden = false;
    });
    btn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') btn.hidden = true;
        deferredPrompt = null;
    });
    window.addEventListener('appinstalled', () => { btn.hidden = true; });
}

/* ----- notifications: 4-state machine ----- */

function getOneSignalSubscription() {
    return window.OneSignal?.User?.PushSubscription || null;
}

async function getBrowserPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            if (!registration.scope.includes('/push/onesignal/')) continue;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) return subscription;
        }
    } catch (e) {
        console.warn('Browser push subscription lookup failed', e);
    }
    return null;
}

let oneSignalInitPromise = null;

function initOneSignal() {
    if (oneSignalInitPromise) return oneSignalInitPromise;
    oneSignalInitPromise = new Promise((resolve, reject) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (OneSignal) {
            try {
                await OneSignal.init({
                    appId: "f2acf5a5-1a22-4313-8c55-58251657a7fe",
                    serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
                    serviceWorkerParam: { scope: "/push/onesignal/" },
                    autoResubscribe: true,
                    notifyButton: { enable: false },
                    promptOptions: {
                        slidedown: {
                            prompts: [{ type: "push", autoPrompt: false }],
                        },
                    },
                    welcomeNotification: { disable: true },
                });
                resolve(OneSignal);
            } catch (e) {
                oneSignalInitPromise = null;
                reject(e);
            }
        });
    });
    return oneSignalInitPromise;
}

async function withOneSignal(callback) {
    const OneSignal = await initOneSignal();
    return callback(OneSignal);
}

/* ----- notify confirmation dialog ----- */

function isIOSWithoutStandalone() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return isIOS && !isStandalone;
}

function classifySubscribeError(e) {
    const name = e?.name || '';
    const msg = String(e?.message || e || '').toLowerCase();
    if (name === 'AbortError' || msg.includes('push service') || msg.includes('registration failed')) {
        return 'pushServiceBlocked';
    }
    return 'error';
}

const NOTIFY_DIALOG_VARIANTS = {
    intro: () => ({
        title: 'Get deadline reminders',
        body: `
            <p>We'll send a push notification <strong>24 hours</strong> and <strong>1 hour</strong> before each deadline.</p>
            <p>No account required. You can turn reminders off anytime from the same button.</p>
            ${isIOSWithoutStandalone()
                ? `<p><strong>iPhone users:</strong> add this site to your Home Screen first, then open it from there. See the <a class="inline-link" target="_blank" rel="noopener" href="https://ruddy-soursop-ccb.notion.site/How-to-Install-Deadline-Dash-on-iOS-1209f5f53c6680ada63fe4b0942deaaf?pvs=73">install guide</a>.</p>`
                : ''}
        `,
        actions: [
            { label: 'Cancel', kind: 'secondary', action: 'close' },
            { label: 'Subscribe', kind: 'primary', action: 'subscribe' },
        ],
    }),
    unsubscribe: () => ({
        title: 'Turn off reminders?',
        body: `<p>You'll stop receiving deadline notifications. You can resubscribe anytime.</p>`,
        actions: [
            { label: 'Keep them on', kind: 'secondary', action: 'close' },
            { label: 'Unsubscribe', kind: 'danger', action: 'unsubscribe' },
        ],
    }),
    loading: (opts) => ({
        title: opts?.title || 'Setting up reminders…',
        body: `<p class="notify-dialog-loading"><span class="notify-dialog-spinner" aria-hidden="true"></span><span>Just a moment.</span></p>`,
        actions: [],
        disableClose: true,
    }),
    success: () => ({
        title: 'You’re set',
        body: `<p>We'll ping you 24 hours and 1 hour before each deadline.</p>`,
        actions: [
            { label: 'Done', kind: 'primary', action: 'close' },
        ],
        autoCloseMs: 1800,
    }),
    permissionDenied: () => ({
        title: 'Notifications are blocked',
        body: `
            <p>Your browser is blocking notifications for this site, so we can't ask for permission again from here.</p>
            <p>To re-enable: click the <strong>lock icon</strong> in the address bar → <strong>Site settings</strong> → set <strong>Notifications</strong> to <em>Allow</em>, then reload.</p>
        `,
        actions: [
            { label: 'OK', kind: 'primary', action: 'close' },
        ],
    }),
    permissionBlockedByOverlay: () => ({
        title: 'Permission prompt was blocked',
        body: `
            <p>Chrome refuses to show permission prompts when another app is drawing on the screen — chat heads, screen-share bubbles, picture-in-picture, accessibility overlays.</p>
            <p>Close any floating overlays from other apps, then try again.</p>
        `,
        actions: [
            { label: 'Cancel', kind: 'secondary', action: 'close' },
            { label: 'Try again', kind: 'primary', action: 'subscribe' },
        ],
    }),
    pushServiceBlocked: () => ({
        title: 'Your browser is blocking the push service',
        body: `
            <p>The browser couldn't reach the push messaging service, so no subscription was created.</p>
            <p><strong>Brave:</strong> open <code>brave://settings/privacy</code> → enable <em>"Use Google services for push messaging"</em> → reload this page.</p>
            <p><strong>Other browsers:</strong> check that an extension or network policy isn't blocking FCM / Mozilla autopush.</p>
        `,
        actions: [
            { label: 'Cancel', kind: 'secondary', action: 'close' },
            { label: 'Try again', kind: 'primary', action: 'subscribe' },
        ],
    }),
    error: () => ({
        title: 'Something went wrong',
        body: `<p>We couldn't set up reminders just now. Please try again — if it keeps failing, your browser may be in private mode or have notifications restricted.</p>`,
        actions: [
            { label: 'Cancel', kind: 'secondary', action: 'close' },
            { label: 'Try again', kind: 'primary', action: 'subscribe' },
        ],
    }),
};

let notifyDialogAutoCloseTimer = null;

function renderNotifyDialog(variantName, opts) {
    const dialog = document.getElementById('notifyDialog');
    const titleEl = document.getElementById('notifyDialogTitle');
    const bodyEl = document.getElementById('notifyDialogBody');
    const actionsEl = document.getElementById('notifyDialogActions');
    const closeEl = document.getElementById('notifyDialogClose');
    if (!dialog || !titleEl || !bodyEl || !actionsEl) return;

    const variantBuilder = NOTIFY_DIALOG_VARIANTS[variantName];
    if (!variantBuilder) return;
    const variant = variantBuilder(opts);

    titleEl.textContent = variant.title;
    bodyEl.innerHTML = variant.body;
    actionsEl.innerHTML = '';

    for (const action of variant.actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `notify-dialog-btn notify-dialog-btn--${action.kind}`;
        btn.textContent = action.label;
        btn.addEventListener('click', () => onNotifyDialogAction(action.action));
        actionsEl.appendChild(btn);
    }

    if (closeEl) closeEl.hidden = !!variant.disableClose;
    dialog.dataset.variant = variantName;
    dialog.dataset.disableClose = variant.disableClose ? '1' : '';

    if (notifyDialogAutoCloseTimer) {
        clearTimeout(notifyDialogAutoCloseTimer);
        notifyDialogAutoCloseTimer = null;
    }
    if (variant.autoCloseMs) {
        notifyDialogAutoCloseTimer = setTimeout(() => closeNotifyDialog(), variant.autoCloseMs);
    }
}

function openNotifyDialog(variantName, opts) {
    const dialog = document.getElementById('notifyDialog');
    if (!dialog) return;
    renderNotifyDialog(variantName, opts);
    if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        document.body.classList.add('notify-dialog-open');
    }
}

function closeNotifyDialog() {
    const dialog = document.getElementById('notifyDialog');
    if (!dialog) return;
    if (notifyDialogAutoCloseTimer) {
        clearTimeout(notifyDialogAutoCloseTimer);
        notifyDialogAutoCloseTimer = null;
    }
    if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }
    document.body.classList.remove('notify-dialog-open');
}

async function performSubscribeFromDialog() {
    // iOS Safari requires Notification.requestPermission() to run inside the
    // user-gesture window from the Subscribe click. Read permission state
    // synchronously and call requestPermission with no async hops in front of
    // it so the gesture isn't lost.
    const currentPermission = (typeof Notification !== 'undefined') ? Notification.permission : 'denied';

    if (currentPermission === 'denied') {
        openNotifyDialog('permissionDenied');
        return;
    }

    if (currentPermission === 'default') {
        let permission;
        try {
            permission = await Notification.requestPermission();
        } catch (e) {
            console.error('Permission request failed', e);
            openNotifyDialog('error');
            return;
        }
        if (permission === 'denied') {
            openNotifyDialog('permissionDenied');
            return;
        }
        if (permission === 'default') {
            // Chrome for Android refusing to prompt because of a floating overlay,
            // or the user dismissed the prompt without choosing.
            openNotifyDialog('permissionBlockedByOverlay');
            return;
        }
    }

    // Permission is now 'granted' — register the subscription.
    openNotifyDialog('loading');
    try {
        await withOneSignal((OneSignal) => OneSignal.User.PushSubscription.optIn());
        openNotifyDialog('success');
    } catch (e) {
        console.error('Subscribe failed', e);
        openNotifyDialog(classifySubscribeError(e));
    } finally {
        refreshNotificationButton();
    }
}

async function performUnsubscribeFromDialog() {
    openNotifyDialog('loading', { title: 'Turning off reminders…' });
    try {
        await withOneSignal((OneSignal) => OneSignal.User.PushSubscription.optOut());
        closeNotifyDialog();
    } catch (e) {
        console.error('Unsubscribe failed', e);
        openNotifyDialog('error');
    } finally {
        refreshNotificationButton();
    }
}

function onNotifyDialogAction(action) {
    if (action === 'close') { closeNotifyDialog(); return; }
    if (action === 'subscribe') { performSubscribeFromDialog(); return; }
    if (action === 'unsubscribe') { performUnsubscribeFromDialog(); return; }
}

async function deriveNotificationState() {
    if (!('Notification' in window)) return 'unsupported';
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    if (Notification.permission === 'default') return 'prompt';
    const sub = getOneSignalSubscription();
    if (!sub) {
        const browserSub = await getBrowserPushSubscription();
        return browserSub ? 'subscribed' : 'pending';
    }
    if (sub.optedIn === false) return 'unsubscribed';
    // optedIn is just a stored preference — the user only actually receives
    // pushes when there's a real push subscription token behind it. If the SW
    // failed to register a token (ad blocker, push service error, stale state),
    // surface that as "Notify Me" so clicking can attempt to recover instead of
    // claiming a working subscription that doesn't exist.
    if (!sub.token) return 'unsubscribed';
    return 'subscribed';
}

function paintNotificationButton(state) {
    const btn = document.getElementById('notificationButton');
    const cohortNote = document.getElementById('cohortNote');
    const dismissed = localStorage.getItem('cohortNoteDismissed') === '1';
    if (cohortNote) cohortNote.hidden = state !== 'subscribed' || dismissed;

    if (!btn) return;
    btn.disabled = false;
    btn.dataset.state = '';

    switch (state) {
        case 'unsupported':
            btn.hidden = true;
            return;
        case 'blocked':
            btn.textContent = 'Blocked';
            btn.dataset.state = 'blocked';
            btn.disabled = true;
            break;
        case 'subscribed':
            btn.textContent = 'Subscribed';
            btn.dataset.state = 'active';
            break;
        case 'pending':
        case 'unsubscribed':
        case 'prompt':
        default:
            btn.textContent = 'Notify Me';
            break;
    }
    btn.hidden = false;
}

async function refreshNotificationButton() {
    const state = await deriveNotificationState();
    paintNotificationButton(state);
}

async function handleNotificationClick() {
    const state = await deriveNotificationState();

    if (state === 'unsupported') return;
    if (state === 'blocked') { openNotifyDialog('permissionDenied'); return; }
    if (state === 'subscribed') { openNotifyDialog('unsubscribe'); return; }
    // prompt | unsubscribed | pending → show the intro and let the user confirm
    openNotifyDialog('intro');
}

function initNotifications() {
    const btn = document.getElementById('notificationButton');
    if (!btn) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        btn.hidden = true;
        return;
    }
    btn.addEventListener('click', handleNotificationClick);

    // Paint immediately from whatever state we can derive without OneSignal,
    // then kick off init so returning subscribers don't see a "Notify Me" flash.
    refreshNotificationButton();
    initOneSignal()
        .then((OneSignal) => {
            const sub = OneSignal?.User?.PushSubscription;
            if (sub && typeof sub.addEventListener === 'function') {
                sub.addEventListener('change', refreshNotificationButton);
            }
            return refreshNotificationButton();
        })
        .catch((e) => {
            console.warn('OneSignal init failed', e);
            refreshNotificationButton();
        });

    // dialog: close button, ESC, and backdrop click
    const dialog = document.getElementById('notifyDialog');
    const dialogClose = document.getElementById('notifyDialogClose');
    if (dialog) {
        if (dialogClose) dialogClose.addEventListener('click', closeNotifyDialog);
        // backdrop click: native <dialog> reports e.target === dialog when the
        // user clicks outside the content (i.e., on the ::backdrop).
        dialog.addEventListener('click', (e) => {
            if (dialog.dataset.disableClose === '1') return;
            if (e.target === dialog) closeNotifyDialog();
        });
        // ESC: <dialog> fires a 'cancel' event before closing — block it during
        // loading so the user can't interrupt an in-flight subscribe.
        dialog.addEventListener('cancel', (e) => {
            if (dialog.dataset.disableClose === '1') e.preventDefault();
        });
        dialog.addEventListener('close', () => {
            document.body.classList.remove('notify-dialog-open');
        });
    }

    // cohort unsubscribe link routes through the confirmation dialog
    const cohortBtn = document.getElementById('cohortUnsubscribe');
    if (cohortBtn) {
        cohortBtn.addEventListener('click', () => openNotifyDialog('unsubscribe'));
    }

    // dismiss button — persist so the note stays hidden across sessions
    const cohortDismiss = document.getElementById('cohortDismiss');
    if (cohortDismiss) {
        cohortDismiss.addEventListener('click', () => {
            const note = document.getElementById('cohortNote');
            if (note) note.hidden = true;
            try { localStorage.setItem('cohortNoteDismissed', '1'); } catch (e) {}
        });
    }
}

/* ----- filters ----- */

function initFilters() {
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => applyFilter(chip.dataset.filter));
    });
}

/* ----- mobile menu ----- */

function initMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const menu = document.getElementById('utilityMenu');
    const backdrop = document.getElementById('menuBackdrop');
    const closeBtn = document.getElementById('menuClose');
    if (!toggle || !menu || !backdrop) return;

    const close = () => {
        menu.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
    };
    const open = () => {
        menu.classList.add('is-open');
        backdrop.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('menu-open');
    };

    toggle.addEventListener('click', () => {
        const isOpen = menu.classList.contains('is-open');
        if (isOpen) close(); else open();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    menu.querySelectorAll('.menu-link, #installButton').forEach(el => {
        el.addEventListener('click', close);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.classList.contains('is-open')) close();
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 640 && menu.classList.contains('is-open')) close();
    });
}

/* ----- boot ----- */

document.addEventListener('DOMContentLoaded', async () => {
    initDarkMode();
    initInstallButton();
    initNotifications();
    initFilters();
    initMobileMenu();

    const data = await loadDeadlines();
    renderAll(data);
    setInterval(tickAll, 1000);
});
