// Function to update the countdown every second
function startCountdown(id, eventDate) {
    const countdownElement = document.getElementById(id);

    // Update the countdown every 1000 milliseconds (1 second)
    const interval = setInterval(function() {
        const now = new Date().getTime();  // Get the current time
        const distance = eventDate - now;  // Time difference between now and the event date

        // Calculate time units
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Display the result in the HTML
        countdownElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        // If the countdown has finished, display "EXPIRED"
        if (distance < 0) {
            clearInterval(interval);  // Stop the countdown
            countdownElement.innerHTML = "EXPIRED";
        }
    }, 1000); // 1 second interval
}

// Define the event dates
const event1Date = new Date("March 12, 2025 00:00:00").getTime();
const event2Date = new Date("March 12, 2025 00:00:00").getTime();
const event3Date = new Date("March 12, 2025 00:00:00").getTime();
const event4Date = new Date("March 19, 2025 00:00:00").getTime();


// Start the countdowns for the events
startCountdown("timer1", event1Date);
startCountdown("timer2", event2Date);
startCountdown("timer3", event3Date);
startCountdown("timer4", event4Date);
