import os
from pathlib import Path
from dotenv import load_dotenv

PYTHON_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PYTHON_DIR.parent

# Load the app-level env files first so the forecasting script can reuse the
# same local Supabase credentials as the Next.js application.
load_dotenv(PROJECT_ROOT / ".env.local")
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PYTHON_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Forecasting configuration
LOOKBACK_MONTHS = 6
FORECAST_AHEAD_MONTHS = 1
MODEL_VERSION = "v1.0-linear"
