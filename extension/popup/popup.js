/**
 * POPUP.JS - PomodoroPal Chrome extension popup script
 * 
 * WHAT THIS FILE DOES
 * This script controls the popup UI that appears when users click the extension icon (tomato) 
 * in Chrome. It's the main interface for interacting with the Pomodoro timer. The popup
 * doesn't run the timer, it just displays the state and sends commands to the background 
 * script (background.js).
 * 
 * MAIN FEATURES
 * 1. Timer display: Shows the countdown in MM:SS format. I update this every 100ms by
 *    requesting the current state from the background script. I chose 100ms instead of
 *    1000ms to make the countdown feel more responsive.
 * 2. Control buttons: There are 3 main buttons for timer control.
 *    - Start: Sends START_TIMER message to background script.
 *    - Pause: Sends PAUSE_TIMER message to background script.
 *    - Reset: Sends RESET_TIMER message to background script.
 *    The UI automatically shows/hides start/pause buttons based on the timer state.
 * 3. Mode switching: Users can switch between work (Pomodoro), short break, and long break 
 *    by clicking the mode buttons. Each button has a data-mode attribute that helps me
 *    identify which mode was selected.
 * 4. Settings navigation: The settings button (gear icon) opens settings.html (a separate 
 *    page where users can configure blocked sites and other options).
 * 
 * HOW IT WORKS
 * - On load, it sets up all event listeners and requests the initial state.
 * - Every 100ms, it requests the latest timer state from the background script.
 * - When the state updates, updateDisplay() refreshes the UI.
 * - All user actions are sent to the background script via chrome.runtime.sendMessage().
 * - The background script responds with the updated state, which refreshes the UI.
 * 
 * NOTE
 * I learned that Chrome extension popups can close at any time, so I can't store the timer 
 * state here. That's why the background script is the most reliable way to keep track of 
 * the timer state I found.
 **/

// DOM elements
const elements = {
  minutes: document.getElementById('minutes'),
  seconds: document.getElementById('seconds'),
  // Buttons
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  modeButtons: document.querySelectorAll('.btn-mode')
};

// State
let currentState = null;

// Initialize: When DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadState();
  // Update timer: Every 100ms for countdown
  setInterval(updateFromBackground, 100);
});

// Event listeners: Setup all
function setupEventListeners() {
  elements.startBtn.addEventListener('click', () => {
    sendMessage({ action: 'START_TIMER' });
  });

  elements.pauseBtn.addEventListener('click', () => {
    sendMessage({ action: 'PAUSE_TIMER' });
  });

  elements.resetBtn.addEventListener('click', () => {
    sendMessage({ action: 'RESET_TIMER' });
  });

  elements.modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const newMode = button.dataset.mode;
      sendMessage({ action: 'SWITCH_MODE', mode: newMode });
    });
  });

  // Settings button: Add listener
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });

}

// Send message to background script
function sendMessage(message) {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error:', chrome.runtime.lastError);
      return;
    }
    currentState = response;
    updateDisplay();
  });
}

// Load state from background
function loadState() {
  sendMessage({ action: 'GET_STATE' });
}

// Update from background periodically
function updateFromBackground() {
  chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
    if (chrome.runtime.lastError) return;
    currentState = response;
    updateDisplay();
  });
}

// Update UI: Based on current state
function updateDisplay() {
  if (!currentState) return;

  // Update: Timer display
  const minutes = Math.floor(currentState.timeRemaining / 60);
  const seconds = currentState.timeRemaining % 60;

  elements.minutes.textContent = String(minutes).padStart(2, '0');
  elements.seconds.textContent = String(seconds).padStart(2, '0');

  // Update: Buttons visibility
  if (currentState.isRunning) {
    elements.startBtn.style.display = 'none';
    elements.pauseBtn.style.display = 'block';
  } else {
    elements.startBtn.style.display = 'block';
    elements.pauseBtn.style.display = 'none';
  }

  // Update: Mode buttons
  elements.modeButtons.forEach(button => {
    if (button.dataset.mode === currentState.mode) {
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
    }
  });

  // Update: Document title
  document.title = `${minutes}:${String(seconds).padStart(2, '0')} - PomodoroPal`;
}
