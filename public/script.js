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
        const res = await fetch('/deadlines.json', { cache: 'no-store' });
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





// --- Simple Notification Button Logic ---

// Function to update button UI based on NATIVE browser permission
const updateSimpleNotificationButtonUI = (permission) => {
    const notificationButton = document.getElementById('notificationButton');
    const notificationButtonSidebar = document.getElementById('notificationButtonSidebar');
    const buttons = [notificationButton, notificationButtonSidebar];

    buttons.forEach(button => {
        if (!button) return; // Skip if button doesn't exist

        const icon = button.querySelector('i');
        const textSpan = button.querySelector('.notification-text');
        if (!icon || !textSpan) return;

        // Reset classes and state
        button.disabled = false;
        button.classList.remove('subscribed', 'blocked');
        icon.className = 'fas fa-bell'; // Default icon

        switch (permission) {
            case 'granted':
                textSpan.textContent = 'Notifications On'; // Or "Already Subscribed"
                icon.className = 'fas fa-check-circle';
                button.classList.add('subscribed');
                button.disabled = true; // No action needed if already granted
                break;
            case 'denied':
                textSpan.textContent = 'Notifications Blocked';
                icon.className = 'fas fa-bell-slash';
                button.classList.add('blocked');
                button.disabled = true; // User must change in browser settings
                break;
            case 'default':
            default: // Includes initial 'loading' or unknown state
                textSpan.textContent = 'Notify Me'; // Or "Enable Notifications"
                icon.className = 'fas fa-bell';
                button.disabled = false; // Allow clicking to prompt
                break;
        }
    });
};

// Function to handle the click event
const handleSimpleNotificationClick = () => {
    // Check permission again right before requesting
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(newPermission => {
            console.log("Browser Notification Permission:", newPermission);
            // Update the UI based on the user's choice
            updateSimpleNotificationButtonUI(newPermission);

            // Optional: If you explicitly disabled autoRegister in OneSignal init,
            // you might need to manually trigger registration here if granted.
            // if (newPermission === 'granted') {
            //    OneSignal.Notifications.registerForPushNotifications();
            // }

        }).catch(error => {
            console.error("Error requesting notification permission:", error);
            // Optionally update UI to show an error
        });
    } else {
        // If permission is already granted or denied, clicking does nothing more here.
        console.log(`Button clicked, but permission is already ${Notification.permission}`);
        // Update UI just in case it was somehow out of sync
        updateSimpleNotificationButtonUI(Notification.permission);
    }
};

// Function to set everything up
const initializeSimpleNotificationButtons = () => {
    // Check if Notifications are supported by the browser
    if (!('Notification' in window)) {
        console.warn("This browser does not support desktop notification");
        // Optionally hide the buttons or show a message
        const notificationButton = document.getElementById('notificationButton');
        const notificationButtonSidebar = document.getElementById('notificationButtonSidebar');
        if (notificationButton) notificationButton.style.display = 'none';
        if (notificationButtonSidebar) notificationButtonSidebar.style.display = 'none';
        return; // Stop initialization
    }

    // Get button elements
    const notificationButton = document.getElementById('notificationButton');
    const notificationButtonSidebar = document.getElementById('notificationButtonSidebar');

    // Initial UI update based on current permission
    updateSimpleNotificationButtonUI(Notification.permission);

    // Add click listeners
    if (notificationButton) {
        notificationButton.addEventListener('click', handleSimpleNotificationClick);
    }
    if (notificationButtonSidebar) {
        notificationButtonSidebar.addEventListener('click', handleSimpleNotificationClick);
    }

    // Optional: Listen for external changes (less common without full SDK use, but possible)
    // navigator.permissions?.query({ name: 'notifications' }).then(permissionStatus => {
    //     permissionStatus.onchange = () => {
    //         console.log('Native permission status changed externally.');
    //         updateSimpleNotificationButtonUI(permissionStatus.state);
    //     };
    // });
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

