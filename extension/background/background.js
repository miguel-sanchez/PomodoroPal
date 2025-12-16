/**
 * BACKGROUND.JS - PomodoroPal Chrome extension script
 * 
 * WHAT THIS FILE DOES
 * This is the background service worker for the extension. It runs in the background
 * and handles the Pomodoro timer, communicates with the Flask API, and manages
 * the site blocking feature. Reference used for Chrome extension architecture: 
 * (https://developer.chrome.com/docs/extensions/develop/concepts/service-workers).
 * 
 * MAIN FEATURES
 * 1. Timer management: Handles the timer countdown using Chrome's alarms API.
 *    I use alarms instead of setInterval because I discovered that service workers 
 *    can be stopped by Chrome to save resources, but alarms persist. The timer state 
 *    is saved to chrome.storage.local so it survives if the browser restarts.
 * 2. Message handling: Listens for messages from the popup (the UI that users see when they
 *    click the extension icon). Actions include START_TIMER, PAUSE_TIMER, RESET_TIMER, and
 *    SWITCH_MODE. Reference used for message passing between extension components: 
 *    (https://developer.chrome.com/docs/extensions/mv3/messaging/).
 * 3. Session tracking: When a timer is completed (or gets reset), I save the session data to
 *    the Flask backend (via a POST request). This includes session type, duration, completion
 *    status, and timestamps. I use async/await for the API calls.
 * 4. Notifications: Shows browser notifications when a timer is completed. I set 
 *    requireInteraction to true so users don't miss the notification.
 * 5. Site blocking: Uses Chrome declarativeNetRequest API to block distracting websites
 *    (during work sessions). I learned this API is more powerful than the old webRequest API.
 *    It redirects blocked sites to a custom page (blocked.html).
 * 6. Badge updates: Updates the extension icon (tomato) badge to show remaining minutes. That way
 *    users get a quick indicator without opening the popup.
 *
 * HOW IT WORKS
 * - Timer state is stored in a global object. It is also synced to chrome.storage.local.
 * - Chrome alarms tick every second to update the countdown.
 * - When the timer is completed, it saves the session, shows a notification, and automatically 
 *   switches to the next mode.
 * - Blocking rules are updated based on timer state and user settings.
 **/

// Timer: Configuration (in minutes)
const TIMER_CONFIG = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15
};

// API configuration
const API_URL = 'http://127.0.0.1:5000/api';

// Timer: Global state
let timerState = {
  mode: 'pomodoro',
  timeRemaining: TIMER_CONFIG.pomodoro * 60,
  isRunning: false,
  startedAt: null,
  pausedAt: null
};

// Timer: Initialize state from storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['timerState'], (result) => {
    if (result.timerState) {
      timerState = { ...timerState, ...result.timerState };
      // Timer: If it was running, resume it
      if (timerState.isRunning && timerState.startedAt) {
        resumeTimer();
      }
    }
  });
});

// Handle messages/states from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'GET_STATE':
      sendResponse(timerState);
      break;

    case 'START_TIMER':
      startTimer();
      sendResponse(timerState);
      break;

    case 'PAUSE_TIMER':
      pauseTimer();
      sendResponse(timerState);
      break;

    case 'RESET_TIMER':
      resetTimer();
      sendResponse(timerState);
      break;

    case 'SWITCH_MODE':
      switchMode(request.mode);
      sendResponse(timerState);
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true; // Keep the message channel open for async response
});

// Timer: Functions
function startTimer() {
  if (timerState.isRunning) return;

  timerState.isRunning = true;
  timerState.startedAt = Date.now();

  // Alarm for countdown
  chrome.alarms.create('pomodoroTimer', { periodInMinutes: 1 / 60 }); // Every second

  saveState();
}

function pauseTimer() {
  if (!timerState.isRunning) return;

  timerState.isRunning = false;
  timerState.pausedAt = Date.now();

  // Clear alarm
  chrome.alarms.clear('pomodoroTimer');

  saveState();
}

function resetTimer() {
  // Timer: If it was running, save as incomplete session
  if (timerState.isRunning && timerState.startedAt) {
    const sessionData = {
      session_type: timerState.mode,
      duration_minutes: TIMER_CONFIG[timerState.mode],
      completed: false,
      started_at: new Date(timerState.startedAt).toISOString(),
      ended_at: new Date().toISOString()
    };
    saveSessionToBackend(sessionData);
  }

  timerState.isRunning = false;
  timerState.timeRemaining = TIMER_CONFIG[timerState.mode] * 60;
  timerState.startedAt = null;
  timerState.pausedAt = null;

  // Clear alarm
  chrome.alarms.clear('pomodoroTimer');

  saveState();
}

function switchMode(newMode) {
  if (timerState.isRunning) return;

  timerState.mode = newMode;
  timerState.timeRemaining = TIMER_CONFIG[newMode] * 60;
  timerState.startedAt = null;
  timerState.pausedAt = null;

  saveState();
}

function resumeTimer() {
  if (!timerState.isRunning) return;

  // Calculate elapsed time
  const elapsed = Math.floor((Date.now() - timerState.startedAt) / 1000);
  const originalTime = TIMER_CONFIG[timerState.mode] * 60;
  timerState.timeRemaining = Math.max(0, originalTime - elapsed);

  if (timerState.timeRemaining > 0) {
    chrome.alarms.create('pomodoroTimer', { periodInMinutes: 1 / 60 });
  } else {
    completeTimer();
  }
}

// Alarm tick
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroTimer' && timerState.isRunning) {
    timerState.timeRemaining--;

    if (timerState.timeRemaining <= 0) {
      completeTimer();
    } else {
      // Badge: Update with minutes remaining
      const minutes = Math.ceil(timerState.timeRemaining / 60);
      chrome.action.setBadgeText({ text: String(minutes) });
      chrome.action.setBadgeBackgroundColor({ color: '#FF6347' });
    }

    saveState();
  }
});

function completeTimer() {
  const sessionEndTime = new Date();
  const sessionStartTime = new Date(timerState.startedAt);

  // Save session data to backend
  const sessionData = {
    session_type: timerState.mode,
    duration_minutes: TIMER_CONFIG[timerState.mode],
    completed: true,
    started_at: sessionStartTime.toISOString(),
    ended_at: sessionEndTime.toISOString()
  };

  // Save to backend (don't wait by using async)
  saveSessionToBackend(sessionData);

  timerState.isRunning = false;
  timerState.timeRemaining = 0;

  // Clear alarm
  chrome.alarms.clear('pomodoroTimer');

  // Show notification
  const messages = {
    pomodoro: 'Work session completed! You deserve a break.',
    shortBreak: 'Break finished! Ready to focus again?',
    longBreak: 'Long break finished! Ready for another session?'
  };

  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon128.png',
    title: 'PomodoroPal',
    message: messages[timerState.mode] || 'Timer completed!',
    requireInteraction: true
  });

  // Clear badge
  chrome.action.setBadgeText({ text: '' });

  // Auto-switch mode
  const nextMode = timerState.mode === 'pomodoro' ? 'shortBreak' : 'pomodoro';
  switchMode(nextMode);

  saveState();
}

function saveState() {
  chrome.storage.local.set({ timerState });
}

// Save session to backend
async function saveSessionToBackend(sessionData) {
  try {
    const response = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionData)
    });

    const data = await response.json();
    console.log('Session saved to backend:', data);
    return data;
  } catch (error) {
    console.error('[Error] Failed to save session to backend:', error);
    return null;
  }
}

// Site blocking system
let blockingRules = [];

// Initialize blocking system
chrome.runtime.onInstalled.addListener(() => {
  // Clear any existing rules
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    const ruleIds = rules.map(rule => rule.id);
    if (ruleIds.length > 0) {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }
  });
});

// Update blocking rules based on timer state
function updateBlockingRules() {
  chrome.storage.local.get(['blockingEnabled', 'blockDuringWork', 'blockedSites'], (result) => {
    const blockingEnabled = result.blockingEnabled !== undefined ? result.blockingEnabled : true;
    const blockDuringWork = result.blockDuringWork !== undefined ? result.blockDuringWork : true;
    const blockedSites = result.blockedSites || [
      'facebook.com',
      'x.com',
      'instagram.com',
      'youtube.com',
      'reddit.com',
      'tiktok.com'
    ];

    // Determine if we should block sites
    const shouldBlock = blockingEnabled && timerState.isRunning && (!blockDuringWork || timerState.mode === 'pomodoro');

    if (shouldBlock) {
      enableBlocking(blockedSites);
    } else {
      disableBlocking();
    }
  });
}

// Site blocking: Enable
function enableBlocking(sites) {
  // Create blocking rules
  const rules = sites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/blocked/blocked.html"
      }
    },
    condition: {
      urlFilter: `*://*.${site}/*`,
      resourceTypes: ["main_frame"]
    }
  }));

  // Also block without subdomain
  const additionalRules = sites.map((site, index) => ({
    id: sites.length + index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/blocked/blocked.html"
      }
    },
    condition: {
      urlFilter: `*://${site}/*`,
      resourceTypes: ["main_frame"]
    }
  }));

  const allRules = [...rules, ...additionalRules];

  // Clear existing rules and add new ones
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    const ruleIds = existingRules.map(rule => rule.id);
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds,
      addRules: allRules
    }, () => {
      console.log('Blocking enabled for', sites.length, 'sites');
    });
  });
}

// Site blocking: Disable
function disableBlocking() {
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    const ruleIds = rules.map(rule => rule.id);
    if (ruleIds.length > 0) {
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      }, () => {
        console.log('Blocking disabled');
      });
    }
  });
}

// Update the existing startTimer function (replace the existing one)
function startTimer() {
  if (timerState.isRunning) return;

  timerState.isRunning = true;
  timerState.startedAt = Date.now();

  // Set alarm for countdown
  chrome.alarms.create('pomodoroTimer', { periodInMinutes: 1 / 60 }); // Every second

  // Update blocking rules
  updateBlockingRules();

  saveState();
}

// Update the existing pauseTimer function (replace the existing one)
function pauseTimer() {
  if (!timerState.isRunning) return;

  timerState.isRunning = false;
  timerState.pausedAt = Date.now();

  // Clear alarm
  chrome.alarms.clear('pomodoroTimer');

  // Update blocking rules (will disable if needed)
  updateBlockingRules();

  saveState();
}

// Update the existing completeTimer function
// In completeTimer function, after switching mode, add:
function completeTimer() {
  const sessionEndTime = new Date();
  const sessionStartTime = new Date(timerState.startedAt);

  // Save session data to backend
  const sessionData = {
    session_type: timerState.mode,
    duration_minutes: TIMER_CONFIG[timerState.mode],
    completed: true,
    started_at: sessionStartTime.toISOString(),
    ended_at: sessionEndTime.toISOString()
  };

  // Save to backend (async, don't wait)
  saveSessionToBackend(sessionData);

  timerState.isRunning = false;
  timerState.timeRemaining = 0;

  // Clear alarm
  chrome.alarms.clear('pomodoroTimer');

  // Show notification
  const messages = {
    pomodoro: 'Work session completed! You deserve a break.',
    shortBreak: 'Break finished! Ready to focus again?',
    longBreak: 'Long break finished! Ready for another session?'
  };

  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon128.png',
    title: 'PomodoroPal',
    message: messages[timerState.mode] || 'Timer completed!',
    requireInteraction: true
  });

  // Clear badge
  chrome.action.setBadgeText({ text: '' });

  // Auto-switch mode
  const nextMode = timerState.mode === 'pomodoro' ? 'shortBreak' : 'pomodoro';
  switchMode(nextMode);

  // Update blocking rules (will adjust based on new mode)
  updateBlockingRules();

  saveState();
}

// Listen for storage changes (when the user updates the settings)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.blockingEnabled || changes.blockDuringWork || changes.blockedSites)) {
    updateBlockingRules();
  }
});
