import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Forecasting configuration
LOOKBACK_MONTHS = 6
FORECAST_AHEAD_MONTHS = 1
MODEL_VERSION = "v1.0-linear"
