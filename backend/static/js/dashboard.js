/**
 * DASHBOARD.JS - PomodoroPal dashboard JavaScript
 * 
 * WHAT THIS FILE DOES
 * This is the main JavaScript file for the dashboard. It connects to the Flask backend
 * API to fetch Pomodoro session data and display it in a visual/user-friendly way. I learned how
 * to use fetch() for API calls and Chart.js for creating the visualizations (I learned the 
 * fundamentals of Chart.js a few years ago to create dashboards with Bootstrap 4).
 * 
 * MAIN FEATURES
 * 1. Statistics cards: Show key metrics (e.g., total focus time and completion rate).
 *    I added auto-refresh every 30 seconds so the data stays current without manual page reloads.
 *    I found this feature especially useful after completing a session.
 * 2. Charts for data visualization: I used Chart.js library to create:
 *    - A doughnut/pie chart showing the breakdown of work sessions vs. breaks.
 *    - A bar chart displaying the user's activity over the week.
 * 3. Recent sessions table: Lists the last 10 sessions with their type, duration, and status.
 *    I learned how to format dates nicely/user-friendly (showing "Today" for today's sessions).
 * 4. Export functionality: I guessed this data could be useful for users to measure their productivity.
 *    So I added the option to download their data as CSV or JSON files. I had to
 *    learn about Blob objects (https://developer.mozilla.org/en-US/docs/Web/API/Blob).
 * 
 * HOW I STRUCTURED THE CODE
 * - I used async/await for API calls (I discovered this was cleaner than promise chains).
 * - I added try and catch blocks around fetch calls (can fail for different reasons) to handle errors.
 * - I separated different tasks into functions to keep the code more organized.
 * - I used Chart.js documentation to figure out the chart configurations.  
 * 
 * API ENDPOINTS
 * The Flask backend has two main endpoints this file talks to:
 * - /api/stats: Gets the calculated statistics.
 * - /api/sessions: Returns all session records from the database.
 * 
 * HOW IT STARTS
 * When the page loads, I use DOMContentLoaded to trigger the initial data load. 
 * Then, I set up setInterval() to refresh the stats/sessions every 30 seconds.
 **/

// API URL
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Load: Data when page loads
document.addEventListener('DOMContentLoaded', () => {
  loadStatistics();
  loadSessions();
  loadCharts();

  // Refresh: Refresh data every 30 seconds
  setInterval(() => {
    loadStatistics();
    loadSessions();
  }, 30000);
});

// Statistics: Load from API
async function loadStatistics() {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`);
    const data = await response.json();

    if (data.success) {
      updateStatistics(data.stats);
    }
  } catch (error) {
    console.error('[Error] Failed to load statistics:', error);
  }
}

// Statistics: Update in the UI
function updateStatistics(stats) {
  // Total focus time
  const hours = stats.total_focus_hours || 0;
  document.getElementById('totalFocusTime').textContent = hours >= 1 ? `${hours}h` : `${Math.round(hours * 60)}min`;

  // Sessions completed
  document.getElementById('sessionsCompleted').textContent = stats.completed_sessions || 0;

  // Completion rate
  document.getElementById('completionRate').textContent = `${stats.completion_rate || 0}%`;

  // Today's sessions (calculate this from sessions data)
  loadTodaySessions();
}

// Load: Sessions from API
async function loadSessions() {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    const data = await response.json();

    if (data.success) {
      displaySessions(data.sessions);
    }
  } catch (error) {
    console.error('[Error] Failed to load sessions:', error);
  }
}

// Display: Sessions in the table
function displaySessions(sessions) {
  const tbody = document.getElementById('sessionsTableBody');
  tbody.innerHTML = '';

  // Display: Only 10 most recent sessions
  const recentSessions = sessions.slice(0, 10);

  if (recentSessions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: #9ca3af;">
          No sessions recorded yet. Please, start using the extension to see your productivity data.
        </td>
      </tr>
    `;
    return;
  }

  recentSessions.forEach(session => {
    const row = document.createElement('tr');

    // Format: Dates
    const startDate = new Date(session.started_at);
    const endDate = session.ended_at ? new Date(session.ended_at) : null;

    // Format: Session type
    const typeFormatted = {
      'pomodoro': '🍅 Work',
      'shortBreak': '☕ Short break',
      'longBreak': '🌴 Long break'
    }[session.session_type] || session.session_type;

    row.innerHTML = `
      <td>${typeFormatted}</td>
      <td>${session.duration_minutes} min</td>
      <td>
        <span class="status-badge ${session.completed ? 'status-completed' : 'status-incomplete'}">
          ${session.completed ? 'Completed' : 'Incomplete'}
        </span>
      </td>
      <td>${formatDate(startDate)}</td>
      <td>${endDate ? formatDate(endDate) : '-'}</td>
    `;

    tbody.appendChild(row);
  });
}

// Format: Date for display
function formatDate(date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return `Today ${date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Calculate: Today sessions
async function loadTodaySessions() {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    const data = await response.json();

    if (data.success) {
      const today = new Date().toDateString();
      const todaySessions = data.sessions.filter(session => {
        const sessionDate = new Date(session.created_at).toDateString();
        return sessionDate === today;
      });

      document.getElementById('todaySessions').textContent = todaySessions.length;
    }
  } catch (error) {
    console.error('[Error] Failed to load today sessions:', error);
  }
}

// Charts: Load and display
async function loadCharts() {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    const data = await response.json();

    if (data.success && data.sessions.length > 0) {
      createSessionTypesChart(data.sessions);
      createDailyActivityChart(data.sessions);
    } else {
      // Show empty for charts
      showEmptyCharts();
    }
  } catch (error) {
    console.error('[Error] Failed to load charts:', error);
    showEmptyCharts();
  }
}

// Chart: Doughnut/pie chart for session types
function createSessionTypesChart(sessions) {
  const ctx = document.getElementById('sessionTypesChart').getContext('2d');

  // Count sessions by type
  const typeCounts = {
    'pomodoro': 0,
    'shortBreak': 0,
    'longBreak': 0
  };

  sessions.forEach(session => {
    if (typeCounts.hasOwnProperty(session.session_type)) {
      typeCounts[session.session_type]++;
    }
  });

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Work sessions', 'Short breaks', 'Long breaks'],
      datasets: [{
        data: [
          typeCounts.pomodoro,
          typeCounts.shortBreak,
          typeCounts.longBreak
        ],
        backgroundColor: [
          '#ef4444', // Pomodoro: red
          '#f59e0b', // Short break: orange
          '#10b981'  // Long break: green
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#f9fafb',
            padding: 15,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

// Chart: Bar chart for daily activity
function createDailyActivityChart(sessions) {
  const ctx = document.getElementById('dailyActivityChart').getContext('2d');

  // Get last 7 days
  const days = [];
  const counts = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = date.toDateString();

    // Count sessions for this day
    const dayCount = sessions.filter(session => {
      return new Date(session.created_at).toDateString() === dateString;
    }).length;

    days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    counts.push(dayCount);
  }

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Sessions',
        data: counts,
        backgroundColor: '#d4af37',
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: '#9ca3af'
          },
          grid: {
            color: 'rgba(156, 163, 175, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#9ca3af'
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

// Chart: Show empty state
function showEmptyCharts() {
  const charts = ['sessionTypesChart', 'dailyActivityChart'];

  charts.forEach(chartId => {
    const canvas = document.getElementById(chartId);
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data available yet', canvas.width / 2, canvas.height / 2);
    ctx.fillText('Complete some sessions to see charts', canvas.width / 2, canvas.height / 2 + 20);
  });
}


// Export data: CSV/JSON
document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);
document.getElementById('exportJsonBtn').addEventListener('click', exportToJSON);

// Export data: CSV
async function exportToCSV() {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    const data = await response.json();

    if (!data.success || data.sessions.length === 0) {
      alert('No data to export');
      return;
    }

    // CSV: Create
    const headers = ['Type', 'Duration (min)', 'Status', 'Started at', 'Ended at'];
    const rows = data.sessions.map(session => [
      session.session_type,
      session.duration_minutes,
      session.completed ? 'Completed' : 'Incomplete',
      new Date(session.started_at).toLocaleString(),
      session.ended_at ? new Date(session.ended_at).toLocaleString() : 'N/A'
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // CSV: Download
    downloadFile(csvContent, 'pomodoropal_sessions.csv', 'text/csv');

  } catch (error) {
    console.error('[Error] Failed to export CSV:', error);
    alert('Failed to export data');
  }
}

// Export data: JSON
async function exportToJSON() {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    const data = await response.json();

    if (!data.success || data.sessions.length === 0) {
      alert('No data to export');
      return;
    }

    // JSON: Create
    const exportData = {
      exported_at: new Date().toISOString(),
      total_sessions: data.sessions.length,
      sessions: data.sessions
    };

    const jsonContent = JSON.stringify(exportData, null, 2);

    // JSON: Download
    downloadFile(jsonContent, 'pomodoropal_sessions.json', 'application/json');

  } catch (error) {
    console.error('[Error] Failed to export JSON:', error);
    alert('Failed to export data');
  }
}

// Download file
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
