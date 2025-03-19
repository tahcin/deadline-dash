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
const event1Date = new Date("March 19, 2025 23:30:00").getTime();
const event2Date = new Date("March 19, 2025 23:30:00").getTime();
const event3Date = new Date("March 19, 2025 23:30:00").getTime();
const event4Date = new Date("March 26, 2025 23:30:00").getTime();

// Start countdowns
startCountdown("timer1", event1Date);
startCountdown("timer2", event2Date);
startCountdown("timer3", event3Date);
startCountdown("timer4", event4Date);


//buttons
document.addEventListener("DOMContentLoaded", function () {
    const buttonLinks = {
        countdown1: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+AE21x+BBA_DBE_B1/block-v1:IIMBx+AE21x+BBA_DBE_B1+type@sequential+block@a30079406b774766945f7df7ba37c95b/block-v1:IIMBx+AE21x+BBA_DBE_B1+type@vertical+block@3d2d25f969b84b3b87395be337ec5300",
        countdown2: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+ES21x+BBA_DBE_B1/block-v1:IIMBx+ES21x+BBA_DBE_B1+type@sequential+block@6af5281590564e63870f26b57b78f841/block-v1:IIMBx+ES21x+BBA_DBE_B1+type@vertical+block@vertical7",
        countdown3: "https://apps.iimbx.edu.in/learning/course/course-v1:IIMBx+PJ21x+BBA_DBE_B1/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@sequential+block@3f3d99591cb14a9e9a133b3583251766/block-v1:IIMBx+PJ21x+BBA_DBE_B1+type@vertical+block@27405e39773d443288c557c7f97d7822",
        countdown4: ""
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


//PWA install button - simple instruction as direct prompt is complex for now
const installButton = document.getElementById('installButton');
const installButtonSidebar = document.getElementById('installButtonSidebar');

installButton.addEventListener('click', () => {
    alert('To install the app, look for the "Install" option in your browser menu (usually three dots or lines).');
});
installButtonSidebar.addEventListener('click', () => {
    alert('To install the app, look for the "Install" option in your browser menu (usually three dots or lines).');
});


// Sidebar Functionality
function toggleSidebar() {
    document.getElementById("sidebar").style.width = document.getElementById("sidebar").style.width === "250px" ? "0" : "250px";
}

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
