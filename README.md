# 🍅 PomodoroPal - CS50 Final project
PomodoroPal is a productivity extension and dashboard.

## Video demo: [https://youtu.be/jARWXPRZlBc](https://youtu.be/jARWXPRZlBc)


## Description
PomodoroPal is a productivity system combining a browser extension and a web dashboard. It helps users maintain focus using the Pomodoro Technique while blocking distracting websites. 
It consists of:

1. **Chrome extension**: Pomodoro timer with site blocking.
2. **Web dashboard**: Analytics and session tracking.
3. **REST API**: Data storage and reporting.

### Why PomodoroPal?

I had previous experience developing very humble VS Code extensions. I work as an IT trainer and I created a few extensions to help my frontend development students. But these extensions are just collections of code snippets. [VS Code extensions I created for students](https://marketplace.visualstudio.com/publishers/inarocket).

So I thought I could also create an extension for Google Chrome and to go beyond simple snippets by using what I have learnt of Flask and other useful topics throughout CS50.


## Features

### Extension features
- **Pomodoro timer**: work sessions (25 min), short breaks (5 min), long breaks (15 min).
- **Site blocking**: blocks distracting sites during work sessions.
- **Notifications**: alerts when sessions end.
- **Auto-save**: sessions automatically saved to backend.
- **Clean UI**: distraction-free interface.

### Dashboard features
- **Statistics**: track focus time, completion rates, daily activity.
- **Analytics**: charts showing session types distribution and activity.
- **Data export**: download sessions (CSV or JSON).
- **Responsive design**: works on desktop and mobile.


## Installation

### Prerequisites
- Google Chrome (or Chromium based browser).
- Python 3.9+.
- Git.

### Backend setup

```bash
# Clone the repository
git clone https://github.com/miguel-sanchez/PomodoroPal.git
cd PomodoroPal

# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

The backend will be available at 'http://127.0.0.1:5000'.

**Note**: The database file and 'instance/' directory will be created automatically the first time you run 'python app.py'.

### Extension installation

1. Open Chrome and navigate to 'chrome://extensions/'.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" (top left).
4. Select the 'extension' folder from this project.
5. The PomodoroPal icon should appear in your Chrome toolbar.


## Usage

### Starting a session
1. Click the PomodoroPal extension icon.
2. Select session type: Work (Pomodoro 25 min), Short break (5 min), or Long break (15 min).
3. Click "Start".
4. Work distraction-free: blocked sites will keep you focused.

### Viewing analytics
1. Visit 'http://127.0.0.1:5000' while the backend is running.
2. View your productivity statistics.
3. Export data using the CSV/JSON buttons.

### Configuring blocked sites
1. Click the extension icon (tomato icon).
2. Click the settings button (gear icon).
3. Add/remove sites from your block list.
4. Toggle blocking on/off as you need.


## Architecture

```
PomodoroPal/
├── extension/            # Browser extension
│   ├── manifest.json     # Extension configuration
│   ├── popup/            # Timer and Settings interface
│   ├── background/       # Service worker
│   ├── blocked/          # Block page
│   └── icons/            # Extension icons
│
├── backend/              # Flask application
│   ├── app.py            # Main server
│   ├── config.py         # Configuration
│   ├── instance/         # Database
│   ├── templates/        # HTML templates (dashboard)
│   ├── static/           # CSS/JS files
│   └── requirements.txt  # Python dependencies
│
└── README.md             # This documentation
```


## Technologies used

### Frontend
- HTML5 and CSS (Flexbox and CSSGrid).
- JavaScript.
- Chart.js (dashboard data visualization).
- Chrome extension APIs.

### Backend
- Flask (Python web framework).
- SQLAlchemy ORM.
- SQLite database.
- RESTful API design.


## Main files

### Extension: popup/popup.js
This script controls the popup UI that appears when users click the extension icon (tomato) in Chrome. 
It's the main interface for interacting with the Pomodoro timer. The popup doesn't run the timer, 
it just displays the state and sends commands to the background script (background.js).

#### Main features
1. Timer display: Shows the countdown in MM:SS format. I update this every 100ms by requesting the 
   current state from the background script (I chose 100ms instead of 1000ms to make the 
   countdown feel more responsive).
2. Control buttons: There are 3 main buttons for timer control.
   - Start: Sends START_TIMER message to background script.
   - Pause: Sends PAUSE_TIMER message to background script.
   - Reset: Sends RESET_TIMER message to background script.
   The UI automatically shows/hides start/pause buttons based on the timer state.
3. Mode switching: Users can switch between work (Pomodoro), short break, and long break 
   by clicking the mode buttons. Each button has a data-mode attribute that helps me
   identify which mode was selected.
4. Settings navigation: The settings button (gear icon) opens settings.html (a separate 
   page where users can configure blocked sites and other options).

#### How it works
- On load, it sets up all event listeners and requests the initial state.
- Every 100ms, it requests the latest timer state from the background script.
- When the state updates, updateDisplay() refreshes the UI.
- All user actions are sent to the background script via chrome.runtime.sendMessage().
- The background script responds with the updated state, which refreshes the UI.

### Extension: popup/settings.js
This script manages the settings page (settings.html) where users can configure their 
site blocking preferences. It allows adding/removing websites to block and toggling
blocking options. All settings are saved to chrome.storage.local so they are available
across different browser sessions.

#### Main features
1. Blocked sites management: Users can add/remove websites they want to block during focus sessions.
2. Toggle settings: There are two switches control blocking behavior.
   - "Enable site blocking": Switch to turn blocking on/off completely.
   - "Block only during work sessions": If enabled, sites are only blocked during work (Pomodoro) sessions, 
     but not during breaks.
3. Default sites: I included a list of distracting sites as defaults (Facebook, Instagram, Reddit, 
   TikTok, X, YouTube). Users can remove these or add their own.

#### How it works
- On page load, it reads settings from chrome.storage.local and show them.
- When users add a website: it cleans the URL, checks for duplicates, saves to storage,
  and refreshes the display.
- When users remove a website: it updates the array in storage and refreshes the display.
- Toggle changes are saved to storage immediately.
- The background script listens for storage changes. Then it updates blocking rules accordingly.

### Extension: background/background.js
This is the background service worker for the extension. It runs in the background and 
handles the Pomodoro timer, communicates with the Flask API, and manages the site blocking feature.

#### Main features
1. Timer management: Handles the timer countdown using Chrome's alarms API.
    I use alarms instead of setInterval because I discovered that service workers 
    can be stopped by Chrome to save resources, but alarms persist. The timer state 
    is saved to chrome.storage.local so it survives if the browser restarts.
2. Message handling: Listens for messages from the popup (the UI that users see when they
    click the extension icon). Actions include START_TIMER, PAUSE_TIMER, RESET_TIMER, and
    SWITCH_MODE. Reference used for message passing between extension components: 
    (https://developer.chrome.com/docs/extensions/mv3/messaging/).
3. Session tracking: When a timer is completed (or gets reset), I save the session data to
    the Flask backend (via a POST request). This includes session type, duration, completion
    status, and timestamps. I use async/await for the API calls.
4. Notifications: Shows browser notifications when a timer is completed. I set 
    requireInteraction to true so users don't miss the notification.
5. Site blocking: Uses Chrome declarativeNetRequest API to block distracting websites
    (during work sessions). I learned this API is more powerful than the old webRequest API.
    It redirects blocked sites to a custom page (blocked.html).
6. Badge updates: Updates the extension icon (tomato) badge to show remaining minutes. That way
    users get a quick indicator without opening the popup.

#### How it works
- Timer state is stored in a global object. It is also synced to chrome.storage.local.
- Chrome alarms tick every second to update the countdown.
- When the timer is completed, it saves the session, shows a notification, and automatically 
  switches to the next mode.
- Blocking rules are updated based on timer state and user settings.

### Backend: app.py
This is the main backend server for my PomodoroPal project. It's a Flask application that
provides a REST API for storing and retrieving Pomodoro session data.

#### Main features
1. Database models: I created two SQLAlchemy models to organize the data:
   - User: For future user authentication (not fully implemented yet, but the structure
     is ready if I add login functionality).
   - PomodoroSession: Stores each Pomodoro session with details like type (work/break),
     duration, completion status, and timestamps.
2. API endpoints: I built several RESTful endpoints that the Chrome extension and dashboard use:
   - GET /api/health: Check to verify the server is running.
   - GET /api/sessions: Returns all sessions (limited to last 100 for performance).
   - POST /api/sessions: Creates new session when the extension completes a timer.
   - PUT /api/sessions/<id>: Updates a session (used to mark it as completed).
   - GET /api/stats: Calculates and returns statistics (like total focus time and completion rate).
   RESTful API design principles (GET for reading, POST for creating, PUT for updating).
3. Web dashboard route: I added a simple route (/) that renders the HTML dashboard where
   users can visualize their productivity data.

#### Database
Flask-SQLAlchemy for database operations. I discovered via YouTube and Claude this was easier than raw SQL.
The app uses SQLite (configured in config.py). When the server starts, it automatically
creates the database tables if they don't exist yet using the init_db() function.

#### Use of AI tools
I used Claude and Gemini to help me understand how to work with SQLAlchemy. 
I took adding SQLAlchemy as a challenge, but I was lost when I started learning it.
I only used AI tools as helpers, but the essence of the work is still my own.

### Backend: config.py
This file contains all the configuration settings for the Flask application. I learned that
keeping configuration separate from the main app code is a best practice (makes it easier
to change settings without touching the core application).

#### Main settings
1. Security: The SECRET_KEY is used by Flask for session management and security features.
   I set it up to use an environment variable in production, but it uses a development key 
   for local testing.
2. Database: I'm using SQLite for simplicity (this isn't a big project). 
   The database file is stored in the instance/ folder. 
3. CORS (Cross Origin Resource Sharing): This was important for my Chrome extension to
   communicate with the Flask API (https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS). 
   I configured it to allow requests from localhost and any Chrome extension (chrome-extension://*).
4. Session settings: I set sessions to last 7 days so users can review their productivity of the last week.
5. Other settings: Added pagination limit and timezone configuration for consistency.

### Backend: js/dashboard.js
This is the main JavaScript file for the dashboard. It connects to the Flask backend
API to fetch Pomodoro session data and display it in a visual/user-friendly way. 
I learned how to use fetch() for API calls and Chart.js for creating the visualizations 
(I learned the fundamentals of Chart.js a few years ago to create dashboards with Bootstrap 4).

#### Main features
1. Statistics cards: Show key metrics (e.g., total focus time and completion rate).
   I added auto-refresh every 30 seconds so the data stays current without manual page reloads.
   I found this feature especially useful after completing a session.
2. Charts for data visualization: I used Chart.js library to create:
   - A doughnut/pie chart showing the breakdown of work sessions vs. breaks.
   - A bar chart displaying the user's activity over the week.
3. Recent sessions table: Lists the last 10 sessions with their type, duration, and status.
   I learned how to format dates nicely/user-friendly (showing "Today" for today's sessions).
4. Export functionality: I guessed this data could be useful for users to measure their productivity.
   So I added the option to download their data as CSV or JSON files. I had to
   learn about Blob objects (https://developer.mozilla.org/en-US/docs/Web/API/Blob).

#### API endpoints

| Method | Endpoint            | Description         |
|--------|---------------------|---------------------|
| GET    | `/api/health`       | Health check        |
| GET    | `/api/sessions`     | Get all sessions    |
| POST   | `/api/sessions`     | Create new session  |
| PUT    | `/api/sessions/:id` | Update session      |
| GET    | `/api/stats`        | Get statistics      |


## License

This project is licensed under the MIT License.


## Acknowledgments

- CS50 course staff and professor David J. Malan for being such an amazing source of knowledge and inspiration.
- The Pomodoro Technique® by Francesco Cirillo.
- Open source community for various libraries I have used.
