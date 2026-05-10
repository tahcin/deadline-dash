document.addEventListener("DOMContentLoaded", function() {
    const darkModeSwitch = document.getElementById("darkModeSwitch");
    const darkModeSwitchSidebar = document.getElementById("darkModeSwitchSidebar");


    // Check and apply the saved dark mode preference
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        darkModeSwitch.checked = true;
        darkModeSwitchSidebar.checked = true;
     }

    // Toggle dark mode function for switch
    darkModeSwitch.addEventListener("change", function() {
        document.body.classList.toggle("dark-mode");
        darkModeSwitchSidebar.checked = this.checked; // Sync sidebar switch
        if (this.checked) {
            localStorage.setItem("darkMode", "enabled");
        } else {
            localStorage.setItem("darkMode", "disabled");
        }
    });
    // Toggle dark mode function for sidebar switch (sync main switch)
    darkModeSwitchSidebar.addEventListener("change", function() {
        document.body.classList.toggle("dark-mode");
        darkModeSwitch.checked = this.checked; // Sync main switch
        if (this.checked) {
            localStorage.setItem("darkMode", "enabled");
        } else {
            localStorage.setItem("darkMode", "disabled");
        }
    });
    initializeSimpleNotificationButtons();
    initializeDeadlines();
});

// --- Deadlines pipeline (consumes /deadlines.json produced by the GH Actions sync) ---
const SECTION_BY_CATEGORY = {
    cla: 'countdown',
    midterm: 'countdown',
    assignment: 'assignments',
    liveSession: 'live-sessions',
    other: 'assignments',
};
const EMPTY_MESSAGES = {
    'countdown': 'Yay! No upcoming CLAs or Mid-Terms.',
    'assignments': 'Yay! No upcoming assignments.',
    'live-sessions': 'Yay! No upcoming live sessions.',
};
const SECTION_IDS = ['countdown', 'assignments', 'live-sessions'];
const GRACE_MS = 24 * 60 * 60 * 1000;

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

function shouldShow(d, now) {
    if (d.complete) return false;
    if (!d.learnerHasAccess) return false;
    if (d.courseArchived) return false;
    const due = new Date(d.dueAt).getTime();
    if (!Number.isFinite(due)) return false;
    if (now > due + GRACE_MS) return false;
    return true;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function ensureEmptyStates() {
    for (const id of SECTION_IDS) {
        const sec = document.getElementById(id);
        if (!sec) continue;
        const hasCard = sec.querySelector('.event, .session');
        const hasEmpty = sec.querySelector('.empty-state');
        if (!hasCard && !hasEmpty) {
            const msg = document.createElement('h2');
            msg.className = 'empty-state';
            msg.textContent = EMPTY_MESSAGES[id];
            sec.appendChild(msg);
        } else if (hasCard && hasEmpty) {
            hasEmpty.remove();
        }
    }
}

function renderDeadlines(data) {
    for (const id of SECTION_IDS) {
        const sec = document.getElementById(id);
        if (!sec) continue;
        sec.querySelectorAll('.event, .session, .empty-state').forEach(n => n.remove());
    }

    const now = Date.now();
    const visible = (data.deadlines || [])
        .filter(d => shouldShow(d, now))
        .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

    for (const d of visible) {
        const sectionId = SECTION_BY_CATEGORY[d.category] || 'assignments';
        const section = document.getElementById(sectionId);
        if (!section) continue;
        const due = new Date(d.dueAt).getTime();
        const card = document.createElement('div');
        card.className = 'event';
        if (d.link) card.style.cursor = 'pointer';
        card.innerHTML = `
            <h2>${escapeHtml(d.courseName)}<br>${escapeHtml(d.title)}</h2>
            <div class="timer" data-due="${due}"></div>
        `;
        if (d.link) {
            card.addEventListener('click', () => window.open(d.link, '_blank', 'noopener'));
        }
        section.appendChild(card);
    }

    ensureEmptyStates();
    tickDeadlines();
}

function tickDeadlines() {
    const now = Date.now();
    let removedAny = false;
    document.querySelectorAll('.timer[data-due]').forEach(el => {
        const due = parseInt(el.dataset.due, 10);
        if (!Number.isFinite(due)) return;
        if (now > due + GRACE_MS) {
            const card = el.closest('.event');
            if (card) card.remove();
            removedAny = true;
            return;
        }
        if (now >= due) {
            if (el.textContent !== 'EXPIRED') el.textContent = 'EXPIRED';
            return;
        }
        const distance = due - now;
        const days = Math.floor(distance / 86400000);
        const hours = Math.floor((distance % 86400000) / 3600000);
        const minutes = Math.floor((distance % 3600000) / 60000);
        const seconds = Math.floor((distance % 60000) / 1000);
        el.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    });
    if (removedAny) ensureEmptyStates();
}

async function initializeDeadlines() {
    const data = await loadDeadlines();
    renderDeadlines(data);
    setInterval(tickDeadlines, 1000);
}

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".join-button").forEach(button => {
        if (!button.getAttribute("href") || button.getAttribute("href") === "") {
            button.style.pointerEvents = "none";  // Disable clicks
            button.style.opacity = "0.5";         // Reduce visibility
            button.style.cursor = "not-allowed";  // Change cursor style
            button.textContent = "Link Not Available"; // Update button text
        }
    });
});


// --- PWA install button ---
const installButton = document.getElementById("installButton");
const installButtonSidebar = document.getElementById("installButtonSidebar");
let deferredPrompt;

// Function to hide install buttons
const hideInstallButtons = () => {
    if (installButton) installButton.style.display = 'none';
    if (installButtonSidebar) installButtonSidebar.style.display = 'none';
};

// Check if running as an installed PWA (standalone mode) on page load
// You might also want to check for 'minimal-ui' or 'fullscreen' depending on your manifest
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log("App is running in standalone mode. Hiding install buttons.");
    hideInstallButtons();
} else {
    console.log("App is running in browser tab. Install buttons might be shown if installable.");
    // Initially hide buttons - they will be shown by 'beforeinstallprompt' if applicable
    // This prevents them showing if 'beforeinstallprompt' never fires
     hideInstallButtons(); // Hide until we know it's installable
}


window.addEventListener("beforeinstallprompt", (event) => {
    // Only show the prompt logic if NOT running standalone
    if (!window.matchMedia('(display-mode: standalone)').matches) {
        console.log("beforeinstallprompt fired - App is installable.");
        event.preventDefault(); // Prevent automatic prompt
        deferredPrompt = event; // Store the event

        // Show both install buttons as it's installable
        if (installButton) installButton.style.display = "block"; // Or inline-flex/flex if needed
        if (installButtonSidebar) installButtonSidebar.style.display = "block"; // Or inline-flex/flex
    } else {
         console.log("beforeinstallprompt fired, but app is already standalone. Ignoring.");
         // Ensure buttons remain hidden just in case
         hideInstallButtons();
    }
});

// Function to handle install prompt (remains the same)
async function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt(); // Show install prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            console.log("User accepted the install prompt");
            hideInstallButtons(); // Hide buttons after acceptance
        } else {
            console.log("User dismissed the install prompt");
        }
        deferredPrompt = null; // Reset prompt
    }
}

// Add event listeners ONLY if the buttons exist and might be shown
if (installButton) installButton.addEventListener("click", installPWA);
if (installButtonSidebar) installButtonSidebar.addEventListener("click", installPWA);

// Hide buttons when app is installed (this listener still runs)
window.addEventListener("appinstalled", () => {
    console.log("PWA was installed via appinstalled event.");
    hideInstallButtons(); // Hide buttons explicitly
    deferredPrompt = null; // Clear the prompt reference
});

// --- End of PWA install button ---





// --- Notification button: 4-state machine ---
// prompt: permission=default → click requests permission
// subscribed: permission=granted + OneSignal optedIn → click opts out
// unsubscribed: permission=granted + OneSignal optedOut → click opts back in
// blocked: permission=denied → disabled

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

const updateSimpleNotificationButtonUI = (state) => {
    const buttons = [
        document.getElementById('notificationButton'),
        document.getElementById('notificationButtonSidebar'),
    ];
    buttons.forEach(button => {
        if (!button) return;
        const icon = button.querySelector('i');
        const textSpan = button.querySelector('.notification-text');
        if (!icon || !textSpan) return;

        button.disabled = false;
        button.classList.remove('subscribed', 'blocked');
        icon.className = 'fas fa-bell';
        button.style.display = '';

        switch (state) {
            case 'unsupported':
                button.style.display = 'none';
                break;
            case 'blocked':
                textSpan.textContent = 'Notifications Blocked';
                icon.className = 'fas fa-bell-slash';
                button.classList.add('blocked');
                button.disabled = true;
                break;
            case 'subscribed':
                textSpan.textContent = 'Unsubscribe';
                icon.className = 'fas fa-bell-slash';
                button.classList.add('subscribed');
                break;
            case 'prompt':
            case 'unsubscribed':
            default:
                textSpan.textContent = 'Notify Me';
                icon.className = 'fas fa-bell';
                break;
        }
    });
};

async function refreshNotificationButtonState() {
    const state = await deriveNotificationState();
    updateSimpleNotificationButtonUI(state);
}

const handleSimpleNotificationClick = async () => {
    const state = await deriveNotificationState();
    if (state === 'prompt') {
        try {
            await Notification.requestPermission();
        } catch (e) {
            console.error('requestPermission failed', e);
        }
        setTimeout(refreshNotificationButtonState, 500);
        return;
    }
    if (state === 'subscribed') {
        const sub = getOneSignalSubscription();
        if (sub) {
            try { await sub.optOut(); } catch (e) { console.error('optOut failed', e); }
        }
        refreshNotificationButtonState();
        return;
    }
    if (state === 'unsubscribed') {
        const sub = getOneSignalSubscription();
        if (sub) {
            try { await sub.optIn(); } catch (e) { console.error('optIn failed', e); }
        }
        refreshNotificationButtonState();
        return;
    }
};

const initializeSimpleNotificationButtons = () => {
    const buttons = [
        document.getElementById('notificationButton'),
        document.getElementById('notificationButtonSidebar'),
    ];

    if (!('Notification' in window)) {
        buttons.forEach(b => { if (b) b.style.display = 'none'; });
        return;
    }

    buttons.forEach(b => { if (b) b.addEventListener('click', handleSimpleNotificationClick); });

    refreshNotificationButtonState();

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
        refreshNotificationButtonState();
        try {
            OneSignal.User.PushSubscription.addEventListener('change', refreshNotificationButtonState);
        } catch (e) {
            console.warn('OneSignal subscription change listener failed', e);
        }
    });
};



//Smooth scrolling for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        let target = document.querySelector(this.getAttribute('href'));
        if (!target) return; // Exit if target not found

        target.scrollIntoView({
            behavior: 'smooth'
        });

        if (document.getElementById("sidebar").style.width === "250px") { //If sidebar is open, close it after navigation on mobile
            toggleSidebar();
        }
    });
});


// Initialize sidebar state if needed (e.g., close on page load for mobile)
document.addEventListener('DOMContentLoaded', function() {
    if (window.innerWidth <= 768) { // Example breakpoint, adjust as needed
        document.getElementById("sidebar").style.width = "0";
    }
});


// sidebar fix
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const body = document.body;

    if (sidebar.style.width === "250px" || sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        sidebar.style.width = "0";
        body.style.overflow = "auto";
        overlay.classList.remove('active');
        sidebar.style.overflowY = 'hidden'; // Keep overflow-y: hidden during closing
    } else {
        sidebar.style.width = "250px";
        sidebar.classList.add('open');
        body.style.overflow = "hidden";
        overlay.classList.add('active');
        sidebar.style.overflowY = 'hidden'; // Apply overflow-y: hidden during opening transition
        setTimeout(() => {
            sidebar.style.overflowY = 'auto'; // Revert to auto after opening transition (important for scrollable sidebar content if needed in future)
        }, 300); // Timeout should match your sidebar transition duration (0.3s in your CSS)
    }
}

