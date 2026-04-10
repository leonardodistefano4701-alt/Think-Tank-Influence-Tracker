import os
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'ttit.db')

FEC_API_KEY = os.environ.get("FEC_API_KEY")
CONGRESS_API_KEY = os.environ.get("CONGRESS_API_KEY")
SENATE_LDA_API_KEY = os.environ.get("SENATE_LDA_API_KEY")
NYT_API_KEY = os.environ.get("NYT_API_KEY")
NYT_API_SECRET = os.environ.get("NYT_API_SECRET")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
