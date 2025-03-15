document.addEventListener("DOMContentLoaded", function() {
    const toggleButton = document.getElementById("darkModeToggle");
    const toggleIcon = document.getElementById("toggleIcon");
    const toggleText = document.getElementById("toggleText");

    // Check and apply the saved dark mode preference
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        toggleIcon.textContent = "☀️";
        toggleText.textContent = "Light Mode";
    }

    // Toggle dark mode function
    toggleButton.addEventListener("click", function() {
        document.body.classList.toggle("dark-mode");

        if (document.body.classList.contains("dark-mode")) {
            localStorage.setItem("darkMode", "enabled");
            toggleIcon.textContent = "☀️";
            toggleText.textContent = "Light Mode";
        } else {
            localStorage.setItem("darkMode", "disabled");
            toggleIcon.textContent = "🌙";
            toggleText.textContent = "Dark Mode";
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


