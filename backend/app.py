"""
APP.PY - PomodoroPal Flask backend

WHAT THIS FILE DOES
This is the main backend server for my PomodoroPal project. It's a Flask application that
provides a REST API for storing and retrieving Pomodoro session data.

MAIN COMPONENTS
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

HOW I STRUCTURED IT
- Flask-SQLAlchemy for database operations. I discovered via YouTube and Claude this was easier than raw SQL.
- CORS support so the Chrome extension can communicate with the API from different origins.
- Each model has a to_dict() method to convert database objects to JSON (I found this pattern
  in the Flask documentation and it helped me keep the code more organized).
- I included try-except blocks in all routes to handle errors. It also returns proper HTTP status codes.

DATABASE
The app uses SQLite (configured in config.py). When the server starts, it automatically
creates the database tables if they don't exist yet using the init_db() function.
"""

""" Flask application """

from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

# Initialize Flask app
app = Flask(__name__)
app.config.from_object('config.Config')

# Initialize extensions
db = SQLAlchemy(app)
CORS(app, origins="*", allow_headers="*", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Database models
class User(db.Model):
  """User model for future authentication"""
  id = db.Column(db.Integer, primary_key=True)
  username = db.Column(db.String(80), unique=True, nullable=False)
  email = db.Column(db.String(120), unique=True, nullable=False)
  created_at = db.Column(db.DateTime, default=datetime.utcnow)

  # Relationship
  sessions = db.relationship('PomodoroSession', backref='user', lazy=True)

  def to_dict(self):
    """Convert user to dictionary"""
    return {
      'id': self.id,
      'username': self.username,
      'email': self.email,
      'created_at': self.created_at.isoformat()
    }

class PomodoroSession(db.Model):
  """Model for tracking Pomodoro sessions"""
  id = db.Column(db.Integer, primary_key=True)
  user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
  session_type = db.Column(db.String(20), nullable=False)  # 'pomodoro', 'shortBreak', 'longBreak'
  duration_minutes = db.Column(db.Integer, nullable=False)
  completed = db.Column(db.Boolean, default=False)
  started_at = db.Column(db.DateTime, nullable=False)
  ended_at = db.Column(db.DateTime, nullable=True)
  created_at = db.Column(db.DateTime, default=datetime.utcnow)

  def to_dict(self):
    """Convert session to dictionary"""
    return {
      'id': self.id,
      'user_id': self.user_id,
      'session_type': self.session_type,
      'duration_minutes': self.duration_minutes,
      'completed': self.completed,
      'started_at': self.started_at.isoformat() if self.started_at else None,
      'ended_at': self.ended_at.isoformat() if self.ended_at else None,
      'created_at': self.created_at.isoformat()
    }

# Routes
@app.route('/api/health', methods=['GET'])
def health_check():
  """Health check endpoint"""
  return jsonify({
    'status': 'healthy',
    'timestamp': datetime.utcnow().isoformat()
  })

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
  """Get all Pomodoro sessions"""
  try:
    sessions = PomodoroSession.query.order_by(PomodoroSession.created_at.desc()).limit(100).all()
    return jsonify({
      'success': True,
      'sessions': [session.to_dict() for session in sessions],
      'count': len(sessions)
    })
  except Exception as e:
    return jsonify({
      'success': False,
      'error': str(e)
    }), 500

@app.route('/api/sessions', methods=['POST'])
def create_session():
  """Create a new Pomodoro session"""
  from flask import request

  try:
    data = request.get_json()

    # Validate required fields
    if not data or 'session_type' not in data or 'duration_minutes' not in data:
      return jsonify({
        'success': False,
        'error': 'Missing required fields: session_type, duration_minutes'
      }), 400

    # Create new session
    session = PomodoroSession(
      session_type=data['session_type'],
      duration_minutes=data['duration_minutes'],
      started_at=datetime.fromisoformat(data['started_at'].replace('Z', '+00:00')) if 'started_at' in data else datetime.utcnow(),
      completed=data.get('completed', False),
      ended_at=datetime.fromisoformat(data['ended_at'].replace('Z', '+00:00')) if 'ended_at' in data and data['ended_at'] else None
    )

    db.session.add(session)
    db.session.commit()

    return jsonify({
      'success': True,
      'session': session.to_dict()
    }), 201

  except Exception as e:
    db.session.rollback()
    return jsonify({
      'success': False,
      'error': str(e)
    }), 500

@app.route('/api/sessions/<int:session_id>', methods=['PUT'])
def update_session(session_id):
  """Update a Pomodoro session."""
  from flask import request

  try:
    session = PomodoroSession.query.get_or_404(session_id)
    data = request.get_json()

    # Update fields
    if 'completed' in data:
      session.completed = data['completed']
    if 'ended_at' in data:
      session.ended_at = datetime.fromisoformat(data['ended_at']) if data['ended_at'] else None

    db.session.commit()

    return jsonify({
      'success': True,
      'session': session.to_dict()
    })

  except Exception as e:
    db.session.rollback()
    return jsonify({
      'success': False,
      'error': str(e)
    }), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
  """Get statistics for Pomodoro sessions"""
  try:
    # Total sessions
    total_sessions = PomodoroSession.query.count()
    completed_sessions = PomodoroSession.query.filter_by(completed=True).count()

    # Sessions by type
    pomodoro_count = PomodoroSession.query.filter_by(session_type='pomodoro').count()
    short_break_count = PomodoroSession.query.filter_by(session_type='shortBreak').count()
    long_break_count = PomodoroSession.query.filter_by(session_type='longBreak').count()

    # Calculate total focused time (only completed pomodoros)
    completed_pomodoros = PomodoroSession.query.filter_by(
      session_type='pomodoro',
      completed=True
    ).all()
    total_focus_minutes = sum(p.duration_minutes for p in completed_pomodoros)

    return jsonify({
      'success': True,
      'stats': {
        'total_sessions': total_sessions,
        'completed_sessions': completed_sessions,
        'completion_rate': round((completed_sessions / total_sessions * 100) if total_sessions > 0 else 0, 1),
        'sessions_by_type': {
          'pomodoro': pomodoro_count,
          'short_break': short_break_count,
          'long_break': long_break_count
        },
        'total_focus_minutes': total_focus_minutes,
        'total_focus_hours': round(total_focus_minutes / 60, 1)
      }
    })

  except Exception as e:
    return jsonify({
      'success': False,
      'error': str(e)
    }), 500

# Database initialization
def init_db():
  """Initialize the database"""
  # Create instance directory if it doesn't exist
  # Use absolute path to ensure consistency with config.py
  instance_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'instance')
  if not os.path.exists(instance_path):
    os.makedirs(instance_path)
    print(f"Created instance directory: {instance_path}")
  
  with app.app_context():
    db.create_all()
    print("Database initialized!")

# Web Dashboard Routes
@app.route('/')
def dashboard():
  """Render the main dashboard"""
  return render_template('dashboard.html')

# Add this import at the top of the file (after from flask import Flask, jsonify)
from flask import render_template

if __name__ == '__main__':
  # Database tables: Create if they don't exist
  init_db()

  # Run the application
  app.run(debug=True, port=5000)
