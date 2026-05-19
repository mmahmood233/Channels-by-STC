# File purpose: Loads environment configuration for the Python forecasting pipeline.
import os
from pathlib import Path
from dotenv import load_dotenv

# This file is imported by the forecasting script.
# It keeps environment variables and model settings in one place.

# Path to the python folder.
PYTHON_DIR = Path(__file__).resolve().parent

# Path to the main project folder.
# The main `.env.local` file is stored there.
PROJECT_ROOT = PYTHON_DIR.parent

# Load the app-level env files first so the forecasting script can reuse the
# same local Supabase credentials as the Next.js application.
load_dotenv(PROJECT_ROOT / ".env.local")
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PYTHON_DIR / ".env")

# Supabase URL can come from either Python env names or Next.js env names.
# This makes the Python script work even if only `.env.local` exists in the root.
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")

# Service role key is used by the Python script because the script runs as a
# trusted backend process, not as a normal dashboard user.
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Number of months of sales history used for training.
LOOKBACK_MONTHS = 6

# How many months ahead the script predicts.
FORECAST_AHEAD_MONTHS = 1

# Model version is stored with every forecast row so we know which logic created it.
MODEL_VERSION = "v1.0-linear"
