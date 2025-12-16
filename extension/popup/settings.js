/**
 * SETTINGS.JS - PomodoroPal Chrome extension: Settings script
 * 
 * WHAT THIS FILE DOES
 * This script manages the settings page (settings.html) where users can configure their
 * site blocking preferences. It allows adding/removing websites to block and toggling
 * blocking options. All settings are saved to chrome.storage.local so they are available
 * across different browser sessions.
 * 
 * MAIN FEATURES
 * 1. Blocked sites management: Users can add/remove websites they want to block during
 *    focus sessions.
 * 2. Toggle settings: There are two switches control blocking behavior.
 *    - "Enable site blocking": Switch to turn blocking on/off completely.
 *    - "Block only during work sessions": If enabled, sites are only blocked during
 *      work (Pomodoro) sessions, but not during breaks.
 * 3. Default sites: I included a list of distracting sites as defaults (Facebook, Instagram,
 *    Reddit, TikTok, X, YouTube). Users can remove these or add their own.
 * 
 * HOW IT WORKS
 * - On page load, it reads settings from chrome.storage.local and show them.
 * - When users add a website: it cleans the URL, checks for duplicates, saves to storage,
 *   and refreshes the display.
 * - When users remove a website: it updates the array in storage and refreshes the display.
 * - Toggle changes are saved to storage immediately.
 * - The background script listens for storage changes. Then it updates blocking rules accordingly.
 * 
 * NOTE
 * I use chrome.storage.local instead of localStorage because it's designed for extensions
 * and can be accessed from any extension page (e.g., popup, settings).
 **/

// Default blocked sites
const DEFAULT_BLOCKED_SITES = [
  'facebook.com',
  'instagram.com',
  'reddit.com',
  'tiktok.com',
  'x.com',
  'youtube.com'
];

// Load settings on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'popup.html';
  });

  document.getElementById('addSiteBtn').addEventListener('click', addSite);
  document.getElementById('siteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });

  // Handle both change event and click on slider
  const blockingEnabledInput = document.getElementById('blockingEnabled');
  const blockDuringWorkInput = document.getElementById('blockDuringWork');

  blockingEnabledInput.addEventListener('change', (e) => {
    saveSetting('blockingEnabled', e.target.checked);
  });

  blockingEnabledInput.addEventListener('click', (e) => {
    saveSetting('blockingEnabled', e.target.checked);
  });

  blockDuringWorkInput.addEventListener('change', (e) => {
    saveSetting('blockDuringWork', e.target.checked);
  });

  blockDuringWorkInput.addEventListener('click', (e) => {
    saveSetting('blockDuringWork', e.target.checked);
  });
}

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(['blockedSites', 'blockingEnabled', 'blockDuringWork'], (result) => {
    // Load blocked sites
    const sites = result.blockedSites || DEFAULT_BLOCKED_SITES;
    displaySites(sites);

    // Load toggles
    document.getElementById('blockingEnabled').checked =
      result.blockingEnabled !== undefined ? result.blockingEnabled : true;
    document.getElementById('blockDuringWork').checked =
      result.blockDuringWork !== undefined ? result.blockDuringWork : true;
  });
}

// Display blocked sites
function displaySites(sites) {
  const sitesList = document.getElementById('sitesList');
  sitesList.innerHTML = '';

  if (sites.length === 0) {
    sitesList.innerHTML = '<p style="color: #9ca3af; text-align: center;">No sites blocked</p>';
    return;
  }

  sites.forEach(site => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    siteItem.innerHTML = `
      <span class="site-url">${site}</span>
      <button class="remove-btn" data-site="${site}">Remove</button>
    `;

    siteItem.querySelector('.remove-btn').addEventListener('click', () => {
      removeSite(site);
    });

    sitesList.appendChild(siteItem);
  });
}

// Add a new site
function addSite() {
  const input = document.getElementById('siteInput');
  const site = input.value.trim().toLowerCase();

  if (!site) return;

  // Clean the URL (remove protocol, www, paths)
  const cleanSite = site
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  chrome.storage.local.get(['blockedSites'], (result) => {
    const sites = result.blockedSites || DEFAULT_BLOCKED_SITES;

    if (!sites.includes(cleanSite)) {
      sites.push(cleanSite);
      chrome.storage.local.set({ blockedSites: sites }, () => {
        displaySites(sites);
        input.value = '';
      });
    }
  });
}

// Remove a site
function removeSite(site) {
  chrome.storage.local.get(['blockedSites'], (result) => {
    const sites = result.blockedSites || DEFAULT_BLOCKED_SITES;
    const index = sites.indexOf(site);

    if (index > -1) {
      sites.splice(index, 1);
      chrome.storage.local.set({ blockedSites: sites }, () => {
        displaySites(sites);
      });
    }
  });
}

// Save a setting
function saveSetting(key, value) {
  chrome.storage.local.set({ [key]: value });
}
