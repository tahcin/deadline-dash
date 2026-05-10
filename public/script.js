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

function renderHero(deadline) {
    const hero = document.getElementById('hero');
    if (!deadline) {
        hero.hidden = false;
        hero.dataset.empty = 'true';
        hero.dataset.link = '';
        hero.classList.remove('row--clickable');
        hero.innerHTML = `
            <h1 class="hero-text"><span class="hero-emph">Nothing pending.</span> No upcoming deadlines for Batch 2027 &middot; Term 5.</h1>
        `;
        return;
    }
    hero.hidden = false;
    hero.dataset.empty = 'false';
    hero.dataset.link = deadline.link || '';
    if (deadline.link) hero.classList.add('row--clickable');
    else hero.classList.remove('row--clickable');
    const due = new Date(deadline.dueAt).getTime();
    const heroTitle = normalizeAssessmentTitle(deadline);
    hero.innerHTML = `
        <h1 class="hero-text">
            <span class="hero-emph">${escapeHtml(heroTitle)}</span>
            of ${escapeHtml(deadline.courseName)} is due in
            <span class="hero-emph hero-time" data-due="${due}" data-format="rough"></span>
        </h1>
        <div class="hero-meta">
            <span class="hero-countdown" data-due="${due}"></span>
            <span class="hero-due">${escapeHtml(formatDueLabel(deadline.dueAt))}</span>
        </div>
    `;
}

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

    const heroDeadline = visible[0] || null;
    const restForGroups = heroDeadline ? visible.slice(1) : [];

    renderHero(heroDeadline);
    renderGroups(restForGroups);
    renderCalendar(visible);

    const hero = document.getElementById('hero');
    hero.onclick = () => {
        if (hero.dataset.empty === 'true') return;
        if (hero.dataset.link) window.open(hero.dataset.link, '_blank', 'noopener');
    };

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
            const hero = el.closest('.hero');
            if (row) { row.remove(); removedAny = true; }
            else if (hero) {
                renderHero(null);
            }
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

async function deriveNotificationState() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    if (Notification.permission === 'default') return 'prompt';
    const sub = getOneSignalSubscription();
    if (sub && sub.optedIn === false) return 'unsubscribed';
    return 'subscribed';
}

function paintNotificationButton(state) {
    const btn = document.getElementById('notificationButton');
    const cohortNote = document.getElementById('cohortNote');
    if (cohortNote) cohortNote.hidden = state !== 'subscribed';

    if (!btn) return;
    btn.disabled = false;
    btn.dataset.state = '';
    btn.style.display = '';

    switch (state) {
        case 'unsupported':
            btn.style.display = 'none';
            break;
        case 'blocked':
            btn.textContent = 'Blocked';
            btn.dataset.state = 'blocked';
            btn.disabled = true;
            break;
        case 'subscribed':
            btn.textContent = 'Subscribed';
            btn.dataset.state = 'active';
            break;
        case 'unsubscribed':
        case 'prompt':
        default:
            btn.textContent = 'Subscribe';
            break;
    }
}

async function refreshNotificationButton() {
    const state = await deriveNotificationState();
    paintNotificationButton(state);
}

async function handleNotificationClick() {
    const state = await deriveNotificationState();
    if (state === 'prompt') {
        try { await Notification.requestPermission(); } catch (e) { console.error(e); }
        setTimeout(refreshNotificationButton, 500);
        return;
    }
    if (state === 'subscribed') {
        const sub = getOneSignalSubscription();
        if (sub) { try { await sub.optOut(); } catch (e) { console.error(e); } }
        refreshNotificationButton();
        return;
    }
    if (state === 'unsubscribed') {
        const sub = getOneSignalSubscription();
        if (sub) { try { await sub.optIn(); } catch (e) { console.error(e); } }
        refreshNotificationButton();
        return;
    }
}

function initNotifications() {
    const btn = document.getElementById('notificationButton');
    if (!btn) return;
    if (!('Notification' in window)) {
        btn.style.display = 'none';
        return;
    }
    btn.addEventListener('click', handleNotificationClick);
    refreshNotificationButton();
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
        refreshNotificationButton();
        try {
            OneSignal.User.PushSubscription.addEventListener('change', refreshNotificationButton);
        } catch (e) {
            console.warn('OneSignal change listener failed', e);
        }
    });

    // cohort unsubscribe link mirrors the notification button's opt-out path
    const cohortBtn = document.getElementById('cohortUnsubscribe');
    if (cohortBtn) {
        cohortBtn.addEventListener('click', async () => {
            const sub = getOneSignalSubscription();
            if (sub && sub.optedIn !== false) {
                try { await sub.optOut(); } catch (e) { console.error(e); }
                refreshNotificationButton();
                cohortBtn.textContent = 'Unsubscribed';
            } else {
                handleNotificationClick();
            }
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
