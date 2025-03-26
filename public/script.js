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
    // Initialize Notification Buttons (will be updated by OneSignal)
    updateNotificationButtonUI('loading'); // Initial state (Define this function outside)
});

// Function to update the countdown every second
function startCountdown(id, eventDate) {
    const countdownElement = document.getElementById(id);

    const interval = setInterval(function() {
        const now = new Date().getTime();
        const distance = eventDate - now;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        if (distance < 0) {
            clearInterval(interval);
            countdownElement.innerHTML = "EXPIRED";
        }
    }, 1000);
}

// Define event dates
const event1Date = new Date("March 27, 2025 23:30:00").getTime();
const event2Date = new Date("April 16, 2025 23:30:00").getTime();
const event3Date = new Date("March 19, 2025 23:30:00").getTime();
const event4Date = new Date("March 26, 2025 23:30:00").getTime();


const event5Date = new Date("April 16, 2025 23:30:00").getTime();

// Start countdowns
startCountdown("timer1", event1Date);
startCountdown("timer2", event2Date);
startCountdown("timer3", event3Date);
startCountdown("timer4", event4Date);


startCountdown("timer5", event5Date);


//buttons
document.addEventListener("DOMContentLoaded", function () {
    const buttonLinks = {
        countdown1: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+DS21x+BBA_DBE_B1/block-v1:IIMBx+DS21x+BBA_DBE_B1+type@sequential+block@60a1ae6dfe594e32b6f0b0cea3115736/block-v1:IIMBx+DS21x+BBA_DBE_B1+type@vertical+block@d6c90b034edf4e6db7b9439c6b60264b",
        countdown2: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+PJ21x+BBA_DBE_B1/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@sequential+block@9568632fe87941d6b3ae5a956145c50a/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@vertical+block@ecc2b483cc304f96a1cefd321fb22bfa",
        countdown3: "",
        countdown4: "",

        
        countdown5: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+PJ21x+BBA_DBE_B1/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@sequential+block@8e6f2b5137724553bfad3137e64ff36c/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@vertical+block@0e1cad34c58c4d4696d215dcbcf5954d"
    };

    document.querySelectorAll(".event").forEach(eventBox => {
        eventBox.style.cursor = "pointer"; // Make it clear it's clickable

        eventBox.addEventListener("click", function () {
            const eventId = this.id;
            if (buttonLinks[eventId]) {
                window.open(buttonLinks[eventId], "_blank"); // Open in new tab
            }
        });
    });
});

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


//PWA install button
let deferredPrompt;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault(); // Prevent automatic prompt
  deferredPrompt = event; // Store the event for later use

  // Show both install buttons
  const installButton = document.getElementById("installButton");
  const installButtonSidebar = document.getElementById("installButtonSidebar");

  if (installButton) installButton.style.display = "block";
  if (installButtonSidebar) installButtonSidebar.style.display = "block";
});

// Function to handle install prompt
async function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt(); // Show install prompt

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    deferredPrompt = null; // Reset prompt
  }
}

// Add event listeners to both buttons
document.getElementById("installButton")?.addEventListener("click", installPWA);
document.getElementById("installButtonSidebar")?.addEventListener("click", installPWA);

// Hide buttons when app is installed
window.addEventListener("appinstalled", () => {
  console.log("PWA was installed");

  const installButton = document.getElementById("installButton");
  const installButtonSidebar = document.getElementById("installButtonSidebar");

  if (installButton) installButton.style.display = "none";
  if (installButtonSidebar) installButtonSidebar.style.display = "none";
});


// --- OneSignal Integration & Notification Button Logic ---
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    try {
        await OneSignal.init({
            appId: "f2acf5a5-1a22-4313-8c55-58251657a7fe",
            // Add other config options if you have them
        });

        // Get button elements
        const notificationButton = document.getElementById('notificationButton');
        const notificationButtonSidebar = document.getElementById('notificationButtonSidebar');

        // Function to update UI of both buttons based on permission status
        const updateNotificationButtonUI = (permission) => {
            const buttons = [notificationButton, notificationButtonSidebar];
            buttons.forEach(button => {
                if (!button) return; // Skip if button doesn't exist

                const icon = button.querySelector('i');
                const textSpan = button.querySelector('.notification-text');

                // Reset classes and state
                button.disabled = false;
                button.classList.remove('subscribed', 'blocked');
                icon.className = 'fas fa-bell'; // Default icon

                switch (permission) {
                    case 'granted':
                        textSpan.textContent = 'Notifications On';
                        icon.className = 'fas fa-check-circle'; // Check icon
                        button.classList.add('subscribed');
                        button.disabled = true; // Optionally disable if granted, as primary action is done
                        break;
                    case 'denied':
                        textSpan.textContent = 'Blocked';
                        icon.className = 'fas fa-bell-slash'; // Slashed bell icon
                        button.classList.add('blocked');
                        button.disabled = true; // Disable - user must change in browser settings
                        break;
                    case 'default':
                        textSpan.textContent = 'Notify Me';
                        icon.className = 'fas fa-bell'; // Regular bell icon
                        button.disabled = false;
                        break;
                    case 'loading': // Initial state before check
                    default:
                        textSpan.textContent = 'Checking...';
                        button.disabled = true;
                        break;
                }
            });
        };

        // Initial check for notification permission
        const currentPermission = await OneSignal.Notifications.permission;
        updateNotificationButtonUI(currentPermission);
        console.log("Initial Notification Permission:", currentPermission);


        // Add click listener to both buttons
        const handleNotificationClick = async () => {
            // Re-check permission right before prompting
            const permissionOnClick = await OneSignal.Notifications.permission;
            if (permissionOnClick === 'default') {
                 console.log("Requesting notification permission...");
                 await OneSignal.Notifications.requestPermission();
                 // The permissionChange listener below will handle the UI update
            } else {
                console.log(`Notification button clicked, but permission is already ${permissionOnClick}.`);
                // Optionally show a message if denied:
                // if (permissionOnClick === 'denied') {
                //     alert("Notifications are blocked. Please enable them in your browser settings if you wish to subscribe.");
                // }
            }
        };

        notificationButton?.addEventListener('click', handleNotificationClick);
        notificationButtonSidebar?.addEventListener('click', handleNotificationClick);


        // Listen for permission changes (e.g., after user clicks Allow/Block)
        OneSignal.Notifications.addEventListener('permissionChange', async (permissionChange) => {
            const newPermission = permissionChange.to;
            console.log("Notification Permission Changed To:", newPermission);
            updateNotificationButtonUI(newPermission);
        });

    } catch (error) {
        console.error("OneSignal initialization or notification logic error:", error);
        // Optionally update buttons to show an error state
        updateNotificationButtonUI('error'); // You might want to define an 'error' case in updateUI
    }
});



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


