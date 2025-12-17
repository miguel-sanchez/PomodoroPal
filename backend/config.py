"""
CONFIG.PY - PomodoroPal configuration

WHAT THIS FILE DOES
This file contains all the configuration settings for my Flask application. I learned that
keeping configuration separate from the main app code is a best practice (makes it easier
to change settings without touching the core application).

MAIN SETTINGS
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

ENVIRONMENT VARIABLES
I use python-dotenv to load settings from the .env file (not uploaded to git for security).
For example, SECRET_KEY stays out of version control.
"""

"""Flask application: Configuration"""

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base directory for the application (defined here so __file__ is properly resolved)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
  """Base configuration"""

  # Security
  SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'

  # Database
  # Use absolute path for SQLite database to ensure it's created in the correct location
  SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or f'sqlite:///{os.path.join(BASE_DIR, "instance", "pomodoropal.db")}'
  SQLALCHEMY_TRACK_MODIFICATIONS = False

  # CORS
  CORS_HEADERS = 'Content-Type'
  CORS_ORIGINS = ['http://localhost:5000', 'chrome-extension://*']

  # Session
  PERMANENT_SESSION_LIFETIME = timedelta(days=7)

  # Pagination
  ITEMS_PER_PAGE = 20

  # Time zone
  DEFAULT_TIMEZONE = 'UTC'
