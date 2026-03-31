"""
Main forecasting script.
Reads historical sales from Supabase, generates predictions, writes them back.

Usage:
  cd python
  python scripts/run_forecast.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from config import LOOKBACK_MONTHS, MODEL_VERSION
from utils.db import get_supabase_client
from models.forecaster import prepare_features, predict_next_month


def main():
    print("Starting forecast run...")
    client = get_supabase_client()

    # Calculate date range
    today = datetime.now()
    start_date = (today - relativedelta(months=LOOKBACK_MONTHS)).strftime("%Y-%m-%d")
    forecast_period = (today + relativedelta(months=1)).replace(day=1).strftime("%Y-%m-%d")

    print(f"Lookback from: {start_date}")
    print(f"Forecast period: {forecast_period}")

    # Fetch sales data
    response = client.rpc("", {}).execute()  # Placeholder — will use view or direct query

    # TODO: Implement full pipeline:
    # 1. Query monthly_sales_view or join sales + sale_items
    # 2. Group by device_id, store_id, month
    # 3. For each device+store combination, call predict_next_month
    # 4. Upsert results into forecasts table
    # 5. Log the run in automation_logs

    print("Forecast run complete.")


if __name__ == "__main__":
    main()
