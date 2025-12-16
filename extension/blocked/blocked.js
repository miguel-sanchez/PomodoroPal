/**
 * BLOCKED.JS - PomodoroPal blocked website script
 * 
 * WHAT THIS FILE DOES
 * This script controls the blocked.html page that users see when they try to visit a
 * distracting website during a focus session.
 * 
 * MAIN FEATURES
 * 1. Timer display: Shows how much time is left in the current session. I get
 *    this by sending a message to the background script (GET_STATE action) and then
 *    formatting the seconds into MM:SS format. The timer updates every second using
 *    setInterval.
 * 2. Navigation buttons: Two options for users:
 *    - "Go back" button: Uses history.back() to return to the previous page.
 *    - "View dashboard" button: Opens the Flask dashboard in a new tab so users can
 *      check their productivity stats.
 * 
 * HOW IT WORKS
 * - On page load, it requests the current timer state from background.js.
 * - If a session is running, it displays the remaining time.
 * - If no session is active, it shows "No active session" (this shouldn't happen 
 *   since blocking is only activated during sessions, but I added it as a fallback).
 * - The timer auto-updates every second by repeatedly asking the background script for
 *   the latest state.
 * - I use chrome.runtime.sendMessage() to communicate with the background script. 
 **/

// Timer: Get timer state from background
chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
  if (response && response.isRunning) {
    updateTimer(response.timeRemaining);
  } else {
    document.getElementById('timer').textContent = 'No active session';
  }
});

// Timer: Update display
function updateTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  document.getElementById('timer').textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Timer: Update every second
setInterval(() => {
  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
    if (response && response.isRunning) {
      updateTimer(response.timeRemaining);
    }
  });
}, 1000);


// Buttons: Go back and View dashboard
document.getElementById('backBtn').addEventListener('click', () => {
  history.back();
});

document.getElementById('dashboardBtn').addEventListener('click', () => {
  window.open('http://127.0.0.1:5000/', '_blank');
});
