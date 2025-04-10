/**
 * script.js
 * Handles dark mode, countdown timers, event clicks, PWA installation,
 * notifications, smooth scrolling, and sidebar functionality for Deadline Dash.
 */

document.addEventListener("DOMContentLoaded", function() {
    const darkModeSwitch = document.getElementById("darkModeSwitch");
    const darkModeSwitchSidebar = document.getElementById("darkModeSwitchSidebar");
    const installButton = document.getElementById("installButton"); // Defined early for PWA check
    const installButtonSidebar = document.getElementById("installButtonSidebar"); // Defined early for PWA check

    // --- Dark Mode Logic ---
    // Check and apply the saved dark mode preference
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        if (darkModeSwitch) darkModeSwitch.checked = true;
        if (darkModeSwitchSidebar) darkModeSwitchSidebar.checked = true;
     }

    // Toggle dark mode function for main switch
    if (darkModeSwitch) {
        darkModeSwitch.addEventListener("change", function() {
            document.body.classList.toggle("dark-mode");
            if (darkModeSwitchSidebar) darkModeSwitchSidebar.checked = this.checked; // Sync sidebar switch
            localStorage.setItem("darkMode", this.checked ? "enabled" : "disabled");
        });
    }

    // Toggle dark mode function for sidebar switch (sync main switch)
    if (darkModeSwitchSidebar) {
        darkModeSwitchSidebar.addEventListener("change", function() {
            document.body.classList.toggle("dark-mode");
            if (darkModeSwitch) darkModeSwitch.checked = this.checked; // Sync main switch
            localStorage.setItem("darkMode", this.checked ? "enabled" : "disabled");
        });
    }
    // --- End Dark Mode Logic ---


    // --- PWA Install Button Logic (Initialization) ---
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
        hideInstallButtons(); // Hide until we know it's installable
    }
    // --- End PWA Install Button Logic (Initialization) ---


    // --- Timer Initialization ---
    initializeTimers();
    // --- End Timer Initialization ---

    // --- Notification Button Initialization ---
    initializeSimpleNotificationButtons();
    // --- End Notification Button Initialization ---

    // --- Event Box Click Listeners ---
    initializeEventBoxClicks();
    // --- End Event Box Click Listeners ---

    // --- Join Button Styling ---
    styleDisabledJoinButtons();
    // --- End Join Button Styling ---

    // --- Smooth Scrolling Initialization ---
    initializeSmoothScrolling();
    // --- End Smooth Scrolling Initialization ---

}); // End DOMContentLoaded

// =========================================
// Timer Functions
// =========================================

// Initialize all countdown timers with initial values
function initializeTimers() {
    // Define event dates
    const eventDates = {
        timer1: new Date("April 16, 2025 23:30:00").getTime(),
        timer2: new Date("April 16, 2025 23:30:00").getTime(),
        timer3: new Date("March 19, 2025 23:30:00").getTime(), // Note: This date might be past
        timer4: new Date("March 26, 2025 23:30:00").getTime(), // Note: This date might be past
        timer5: new Date("April 16, 2025 23:30:00").getTime(),
        timer6: new Date("April 16, 2025 23:30:00").getTime(),
        timer7: new Date("April 16, 2025 23:30:00").getTime(), // Example for potential future use
        timer8: new Date("April 16, 2025 23:30:00").getTime(), // Example for potential future use
    };

    // Pre-populate timers first with initial values and start countdowns
    for (const id in eventDates) {
        if (Object.hasOwnProperty.call(eventDates, id)) {
            const eventDate = eventDates[id];
            updateTimerDisplay(id, eventDate); // Initial display
            startCountdown(id, eventDate);     // Start ticking interval
        }
    }
}

// Function to immediately update a timer's display without waiting for interval
function updateTimerDisplay(id, eventDate) {
    const countdownElement = document.getElementById(id);
    // If the element is the container div, find the timer span inside it
    const timerSpan = countdownElement?.querySelector(`#${id.replace('countdown', 'timer')}`);
    if (!timerSpan) {
        // Fallback: Maybe the ID is directly on the timer element (old structure?)
        if (countdownElement && countdownElement.id.startsWith('timer')) {
             // Use countdownElement directly if it's the timer
        } else {
            // console.warn(`Timer span element not found for container #${id}`);
            return; // Exit if neither container nor direct timer found
        }
    }

    const targetElement = timerSpan || countdownElement; // Use the correct element to update

    const now = new Date().getTime();
    const distance = eventDate - now;

    if (distance < 0) {
        targetElement.innerHTML = "EXPIRED";
        // Optional: Add a class to the parent .event div if expired
        targetElement.closest('.event')?.classList.add('expired');
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    targetElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}


// Function to update the countdown every second
function startCountdown(id, eventDate) {
    const countdownElement = document.getElementById(id);
     // If the element is the container div, find the timer span inside it
    const timerSpan = countdownElement?.querySelector(`#${id.replace('countdown', 'timer')}`);

    if (!timerSpan) {
        // Fallback check
        if (countdownElement && countdownElement.id.startsWith('timer')) {
             // Use countdownElement directly
        } else {
             // console.warn(`Timer span element for interval not found for container #${id}`);
            return;
        }
    }
    const targetElement = timerSpan || countdownElement;

    const interval = setInterval(function() {
        const now = new Date().getTime();
        const distance = eventDate - now;

        if (distance < 0) {
            clearInterval(interval);
            targetElement.innerHTML = "EXPIRED";
            // Optional: Add expired class to parent
             targetElement.closest('.event')?.classList.add('expired');
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        targetElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}


// =========================================
// Event Box Click Handling
// =========================================
function initializeEventBoxClicks() {
    const buttonLinks = {
        // Key should be the ID of the clickable .event div
        countdown1: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+ST21x+BBA_DBE_B1/block-v1:IIMBx+ST21x+BBA_DBE_B1+type@sequential+block@15e539d4a41a4a0881b865a77a6f0b7c/block-v1:IIMBx+ST21x+BBA_DBE_B1+type@vertical+block@01d6ea44fd4c447da248e01f03fbb449",
        countdown2: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+PJ21x+BBA_DBE_B1/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@sequential+block@9568632fe87941d6b3ae5a956145c50a/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@vertical+block@ecc2b483cc304f96a1cefd321fb22bfa",
        // countdown3: "", // Example if no link
        // countdown4: "", // Example if no link
        countdown5: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+PJ21x+BBA_DBE_B1/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@sequential+block@8e6f2b5137724553bfad3137e64ff36c/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@vertical+block@0e1cad34c58c4d4696d215dcbcf5954d",
        countdown6: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+ID21x+BBA_DBE_B1/block-v1:IIMBx+ID21x+BBA_DBE_B1+type@sequential+block@602f573cd1eb43b3a41b8d5826cf4f99/block-v1:IIMBx+ID21x+BBA_DBE_B1+type@vertical+block@0025798c6b0441958858ccc6df76a9dd"
        // countdown7, countdown8 etc. if needed
    };

    document.querySelectorAll(".event").forEach(eventBox => {
        const eventId = eventBox.id;
        if (buttonLinks[eventId] && buttonLinks[eventId] !== "") {
            eventBox.style.cursor = "pointer"; // Make it clear it's clickable
            eventBox.addEventListener("click", function () {
                window.open(buttonLinks[eventId], "_blank"); // Open in new tab
            });
        } else {
             eventBox.style.cursor = "default"; // Not clickable
        }
    });
}

// =========================================
// Join Button Styling (for disabled links)
// =========================================
function styleDisabledJoinButtons() {
    document.querySelectorAll(".join-button").forEach(button => {
        if (!button.getAttribute("href") || button.getAttribute("href").trim() === "") {
            button.style.pointerEvents = "none";  // Disable clicks
            button.style.opacity = "0.5";         // Reduce visibility
            button.style.cursor = "not-allowed";  // Change cursor style
            button.textContent = "Link Not Available"; // Update button text
            // Ensure icon is removed or styled appropriately if needed
            const icon = button.querySelector('i');
            if (icon) icon.style.display = 'none'; // Hide icon for disabled button
        }
    });
}

// =========================================
// PWA Install Button Logic (Listeners & Handling)
// =========================================
const installButton = document.getElementById("installButton"); // Re-get in global scope or pass around if needed
const installButtonSidebar = document.getElementById("installButtonSidebar"); // Re-get
let deferredPrompt;

// Helper function (already defined inside DOMContentLoaded, ensure it's accessible or redefine)
const hideInstallButtons = () => {
    if (installButton) installButton.style.display = 'none';
    if (installButtonSidebar) installButtonSidebar.style.display = 'none';
};

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

// Function to handle install prompt
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

// Add event listeners ONLY if the buttons exist (checked during initialization)
if (installButton) installButton.addEventListener("click", installPWA);
if (installButtonSidebar) installButtonSidebar.addEventListener("click", installPWA);

// Hide buttons when app is installed (this listener still runs)
window.addEventListener("appinstalled", () => {
    console.log("PWA was installed via appinstalled event.");
    hideInstallButtons(); // Hide buttons explicitly
    deferredPrompt = null; // Clear the prompt reference
});
// --- End PWA Install Button Logic ---


// =========================================
// Simple Notification Button Logic
// =========================================

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
                textSpan.textContent = 'Notifications On';
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
                textSpan.textContent = 'Notify Me';
                icon.className = 'fas fa-bell';
                button.disabled = false; // Allow clicking to prompt
                break;
        }
    });
};

// Function to handle the click event
const handleSimpleNotificationClick = () => {
    // Check permission again right before requesting
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(newPermission => {
            console.log("Browser Notification Permission:", newPermission);
            updateSimpleNotificationButtonUI(newPermission);

            // Optional: If using OneSignal and autoRegister is false, trigger here
            // if (newPermission === 'granted' && window.OneSignal) {
            //    OneSignal.Notifications.registerForPushNotifications();
            // }

        }).catch(error => {
            console.error("Error requesting notification permission:", error);
            // Optionally update UI to show an error
        });
    } else if ('Notification' in window) {
        // If permission is already granted or denied, clicking does nothing more here.
        console.log(`Button clicked, but permission is already ${Notification.permission}`);
        // Update UI just in case it was somehow out of sync
        updateSimpleNotificationButtonUI(Notification.permission);
    } else {
        console.warn("Notifications not supported by this browser.");
    }
};

// Function to set everything up
const initializeSimpleNotificationButtons = () => {
    const notificationButton = document.getElementById('notificationButton');
    const notificationButtonSidebar = document.getElementById('notificationButtonSidebar');

    // Check if Notifications are supported by the browser
    if (!('Notification' in window)) {
        console.warn("This browser does not support desktop notification");
        // Hide the buttons
        if (notificationButton) notificationButton.style.display = 'none';
        if (notificationButtonSidebar) notificationButtonSidebar.style.display = 'none';
        return; // Stop initialization
    }

    // Initial UI update based on current permission
    updateSimpleNotificationButtonUI(Notification.permission);

    // Add click listeners
    if (notificationButton) {
        notificationButton.addEventListener('click', handleSimpleNotificationClick);
    }
    if (notificationButtonSidebar) {
        notificationButtonSidebar.addEventListener('click', handleSimpleNotificationClick);
    }

    // Optional: Listen for external permission changes (might require Permissions API)
    // navigator.permissions?.query({ name: 'notifications' }).then(permissionStatus => {
    //     permissionStatus.onchange = () => {
    //         console.log('Native permission status changed externally.');
    //         updateSimpleNotificationButtonUI(permissionStatus.state);
    //     };
    // });
};
// --- End Simple Notification Button Logic ---


// =========================================
// Smooth Scrolling for Anchor Links
// =========================================
function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

            // Check if it's just a placeholder '#' or links to a valid ID
            if (href === '#' || !document.querySelector(href)) {
                // If it's just '#', prevent default but do nothing else
                // If it links to an ID that doesn't exist, also do nothing
                e.preventDefault();
                console.warn(`Smooth scroll target "${href}" not found or is just "#".`);
                return;
            }

            e.preventDefault(); // Prevent default jump only if it's a valid internal link

            let target = document.querySelector(href);
            if (!target) return; // Double check target exists

            target.scrollIntoView({
                behavior: 'smooth'
            });

            // Close sidebar if open after navigation (if sidebar logic is present)
            const sidebar = document.getElementById("sidebar");
            const overlay = document.getElementById("sidebarOverlay"); // Assuming overlay exists
            if (sidebar && (sidebar.style.width === "280px" || sidebar.classList.contains('open'))) {
                toggleSidebar(); // Close sidebar
            }
        });
    });
}
// --- End Smooth Scrolling ---


// =========================================
// Sidebar Logic
// =========================================
function initializeSidebarState() {
     // Close sidebar on page load for mobile by default
    if (window.innerWidth <= 768) { // Example breakpoint
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            sidebar.style.width = "0";
            sidebar.classList.remove('open'); // Ensure class is also removed
        }
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay'); // Get overlay
    const body = document.body;

    if (!sidebar || !overlay) {
        console.error("Sidebar or Sidebar Overlay element not found!");
        return;
    }

    // Check if sidebar is currently open or opening
    if (sidebar.style.width === "280px" || sidebar.classList.contains('open')) {
        // Close Sidebar
        sidebar.classList.remove('open'); // Trigger transition via class removal
        sidebar.style.width = "0"; // Explicitly set width to 0
        overlay.classList.remove('active'); // Hide overlay
        body.style.overflow = "auto"; // Restore body scroll
        // No need to manage sidebar overflow during closing usually
    } else {
        // Open Sidebar
        sidebar.style.width = "280px"; // Set width to trigger opening
        sidebar.classList.add('open'); // Add class for state tracking/styling
        overlay.classList.add('active'); // Show overlay
        body.style.overflow = "hidden"; // Prevent body scroll
        // Manage sidebar scroll after transition (optional, based on content)
        // setTimeout(() => {
        //     if (sidebar.classList.contains('open')) { // Check if still open
        //         sidebar.style.overflowY = 'auto';
        //     }
        // }, 300); // Match CSS transition duration
    }
}

// Add listener to overlay to close sidebar as well
const sidebarOverlay = document.getElementById('sidebarOverlay');
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', toggleSidebar);
}
// --- End Sidebar Logic ---
