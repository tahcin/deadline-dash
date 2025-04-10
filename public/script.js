// --- START OF FILE script.js ---

document.addEventListener("DOMContentLoaded", function() {
    const darkModeSwitch = document.getElementById("darkModeSwitch");
    const darkModeSwitchSidebar = document.getElementById("darkModeSwitchSidebar");


    // Check and apply the saved dark mode preference
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        // Check if switches exist before setting checked property
        if (darkModeSwitch) darkModeSwitch.checked = true;
        if (darkModeSwitchSidebar) darkModeSwitchSidebar.checked = true;
     }

    // Toggle dark mode function for switch
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

    // Initialize all timers immediately to prevent delay
    initializeTimers();

    initializeSimpleNotificationButtons();

    initializeEventBoxClicks(); // Initialize event box clicks

    styleDisabledJoinButtons(); // Style disabled join buttons

    initializeSmoothScrolling(); // Initialize smooth scrolling

    initializeSidebarState(); // Initialize sidebar state for mobile

}); // End DOMContentLoaded


// Initialize all countdown timers with initial values
function initializeTimers() {
    // Define event dates
    const eventDates = {
        timer1: new Date("April 16, 2025 23:30:00").getTime(),
        timer2: new Date("April 16, 2025 23:30:00").getTime(),
        timer3: new Date("March 19, 2025 23:30:00").getTime(), // Expired
        timer4: new Date("March 26, 2025 23:30:00").getTime(), // Expired
        timer5: new Date("April 16, 2025 23:30:00").getTime(),
        timer6: new Date("April 16, 2025 23:30:00").getTime(),
        timer7: new Date("April 16, 2025 23:30:00").getTime(), // Example
        timer8: new Date("April 16, 2025 23:30:00").getTime(), // Example
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
    if (!countdownElement) {
        // console.warn(`Timer element with id "${id}" not found.`);
        return;
    }

    const now = new Date().getTime();
    const distance = eventDate - now;

    if (distance < 0) {
        countdownElement.innerHTML = "EXPIRED";
        // Optional: Add a class to the parent .event div if expired
        countdownElement.closest('.event')?.classList.add('expired');
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Function to update the countdown every second
function startCountdown(id, eventDate) {
    const countdownElement = document.getElementById(id);
    if (!countdownElement) return; // Exit if element not found

    // Clear existing interval if any (safety measure)
    // Note: Requires storing interval IDs if you need to manage them elsewhere
    // const existingInterval = countdownElement.getAttribute('data-interval-id');
    // if (existingInterval) clearInterval(parseInt(existingInterval));

    const interval = setInterval(function() {
        const now = new Date().getTime();
        const distance = eventDate - now;

        if (distance < 0) {
            clearInterval(interval);
            countdownElement.innerHTML = "EXPIRED";
            // Optional: Add expired class to parent
            countdownElement.closest('.event')?.classList.add('expired');
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);

    // Optional: Store interval ID on the element
    // countdownElement.setAttribute('data-interval-id', interval);
}


// Event Box Click Handling
function initializeEventBoxClicks() {
    const buttonLinks = {
        // Key should be the ID of the clickable .event div
        countdown1: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+ST21x+BBA_DBE_B1/block-v1:IIMBx+ST21x+BBA_DBE_B1+type@sequential+block@15e539d4a41a4a0881b865a77a6f0b7c/block-v1:IIMBx+ST21x+BBA_DBE_B1+type@vertical+block@01d6ea44fd4c447da248e01f03fbb449",
        countdown2: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+PJ21x+BBA_DBE_B1/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@sequential+block@9568632fe87941d6b3ae5a956145c50a/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@vertical+block@ecc2b483cc304f96a1cefd321fb22bfa",
        // countdown3: "", // Assumes the element with ID 'countdown3' exists but has no link
        // countdown4: "", // Assumes the element with ID 'countdown4' exists but has no link
        countdown5: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+PJ21x+BBA_DBE_B1/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@sequential+block@8e6f2b5137724553bfad3137e64ff36c/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@vertical+block@0e1cad34c58c4d4696d215dcbcf5954d",
        countdown6: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+ID21x+BBA_DBE_B1/block-v1:IIMBx+ID21x+BBA_DBE_B1+type@sequential+block@602f573cd1eb43b3a41b8d5826cf4f99/block-v1:IIMBx+ID21x+BBA_DBE_B1+type@vertical+block@0025798c6b0441958858ccc6df76a9dd"
    };

    document.querySelectorAll(".event").forEach(eventBox => {
        const eventId = eventBox.id;
        // Check if a link exists and is not empty for this event ID
        if (buttonLinks[eventId] && buttonLinks[eventId].trim() !== "") {
            eventBox.style.cursor = "pointer"; // Make it look clickable
            eventBox.addEventListener("click", function () {
                window.open(buttonLinks[eventId], "_blank"); // Open link in new tab
            });
        } else {
            eventBox.style.cursor = "default"; // Keep default cursor if no link
        }
    });
}


// Join Button Styling (for disabled links)
function styleDisabledJoinButtons() {
    document.querySelectorAll(".join-button").forEach(button => {
        // Check if href attribute is missing, empty, or just whitespace
        const href = button.getAttribute("href");
        if (!href || href.trim() === "") {
            button.style.pointerEvents = "none";  // Disable clicks
            button.style.opacity = "0.5";         // Reduce visibility
            button.style.cursor = "not-allowed";  // Change cursor style
            button.textContent = "Link Not Available"; // Update button text
            // Remove the icon if present
            const icon = button.querySelector('i');
            if (icon) icon.remove();
        }
    });
}


// --- START: PWA Install Button Logic (Modified) ---
const installButton = document.getElementById("installButton");
const installButtonSidebar = document.getElementById("installButtonSidebar");
let deferredPrompt;

// Function to hide install buttons
const hideInstallButtons = () => {
    if (installButton) installButton.style.display = 'none';
    if (installButtonSidebar) installButtonSidebar.style.display = 'none';
};

// Check if running as an installed PWA (standalone mode) on page load
// Wrap in DOMContentLoaded or ensure elements exist before calling
document.addEventListener('DOMContentLoaded', () => {
    const installButton = document.getElementById("installButton"); // Re-fetch inside DOMContentLoaded if needed
    const installButtonSidebar = document.getElementById("installButtonSidebar"); // Re-fetch inside DOMContentLoaded

    // You might also want to check for 'minimal-ui' or 'fullscreen' depending on your manifest
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log("App is running in standalone mode. Hiding install buttons.");
        hideInstallButtons();
    } else {
        console.log("App is running in browser tab. Install buttons might be shown if installable.");
        // Initially hide buttons - they will be shown by 'beforeinstallprompt' if applicable
        hideInstallButtons(); // Hide until we know it's installable
    }

    // Add event listeners ONLY if the buttons exist and might potentially be shown
    if (installButton) installButton.addEventListener("click", installPWA);
    if (installButtonSidebar) installButtonSidebar.addEventListener("click", installPWA);
});


window.addEventListener("beforeinstallprompt", (event) => {
    // Only show the prompt logic if NOT running standalone
    if (!window.matchMedia('(display-mode: standalone)').matches) {
        console.log("beforeinstallprompt fired - App is installable.");
        event.preventDefault(); // Prevent automatic prompt
        deferredPrompt = event; // Store the event

        // Re-fetch buttons inside the event listener scope to be safe
        const installButton = document.getElementById("installButton");
        const installButtonSidebar = document.getElementById("installButtonSidebar");

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

// Hide buttons when app is installed (this listener still runs)
window.addEventListener("appinstalled", () => {
    console.log("PWA was installed via appinstalled event.");
    hideInstallButtons(); // Hide buttons explicitly
    deferredPrompt = null; // Clear the prompt reference
});
// --- END: PWA Install Button Logic ---




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
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(newPermission => {
            console.log("Browser Notification Permission:", newPermission);
            // Update the UI based on the user's choice
            updateSimpleNotificationButtonUI(newPermission);

            // Optional: If you explicitly disabled autoRegister in OneSignal init,
            // you might need to manually trigger registration here if granted.
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
         console.warn("Notifications not supported or blocked at a higher level.");
         // Optionally disable the button permanently or show a message
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
    // Make sure permission state is accurate at load time
    updateSimpleNotificationButtonUI(Notification.permission);

    // Add click listeners
    if (notificationButton) {
        notificationButton.addEventListener('click', handleSimpleNotificationClick);
    }
    if (notificationButtonSidebar) {
        notificationButtonSidebar.addEventListener('click', handleSimpleNotificationClick);
    }

    // Optional: Listen for external changes (less common without full SDK use, but possible)
    // Consider using navigator.permissions API if needed for more robust status checks
    // navigator.permissions?.query({ name: 'notifications' }).then(permissionStatus => {
    //     // Initial status check
    //     updateSimpleNotificationButtonUI(permissionStatus.state);
    //     // Listen for changes
    //     permissionStatus.onchange = () => {
    //         console.log('Native permission status changed externally.');
    //         updateSimpleNotificationButtonUI(permissionStatus.state);
    //     };
    // });
};
// --- End Simple Notification Button Logic ---



//Smooth scrolling for nav links
function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

            // Ensure it's not just '#' and the target exists
            if (href === '#' || !document.querySelector(href)) {
                e.preventDefault(); // Prevent default action even for invalid links
                // console.warn(`Smooth scroll target "${href}" not found or is invalid.`);
                return;
            }

            e.preventDefault(); // Prevent default jump for valid internal links

            let target = document.querySelector(href);
            if (!target) return; // Should not happen due to above check, but safety first

            target.scrollIntoView({
                behavior: 'smooth'
            });

            // Close sidebar if open after navigation
            const sidebar = document.getElementById("sidebar");
            // Check if sidebar exists and is open (using style width as indicator)
            if (sidebar && (sidebar.style.width === "280px" || sidebar.classList.contains('open'))) {
                toggleSidebar(); // Assumes toggleSidebar function exists
            }
        });
    });
}


// Initialize sidebar state if needed (e.g., close on page load for mobile)
function initializeSidebarState() {
    // Check on initial load
    if (window.innerWidth <= 768) { // Example breakpoint, adjust as needed
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            sidebar.style.width = "0";
            sidebar.classList.remove('open'); // Ensure class is also removed
        }
    }
    // Optional: Add resize listener if you want it to close/open on resize
    // window.addEventListener('resize', () => { ... });
}


// Sidebar toggle function
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay'); // Use the overlay ID
    const body = document.body;

    if (!sidebar || !overlay) {
        console.error("Sidebar or overlay element not found!");
        return;
    }

    // Check if sidebar is currently considered open
    if (sidebar.classList.contains('open')) {
        // Close Sidebar
        sidebar.classList.remove('open');
        sidebar.style.width = "0"; // Collapse width
        overlay.classList.remove('active'); // Hide overlay
        body.style.overflow = "auto"; // Restore body scroll
    } else {
        // Open Sidebar
        sidebar.style.width = "280px"; // Expand width (adjust value to match CSS)
        sidebar.classList.add('open');
        overlay.classList.add('active'); // Show overlay
        body.style.overflow = "hidden"; // Prevent body scroll
    }
}

// Add listener to overlay to close sidebar when clicked
const sidebarOverlay = document.getElementById('sidebarOverlay');
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', toggleSidebar);
}
