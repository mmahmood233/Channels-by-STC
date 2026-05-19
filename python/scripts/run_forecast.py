# File purpose: Runs the forecasting pipeline and writes forecast results back to Supabase.
"""
Demand Forecasting Script
=========================
Reads historical sales from Supabase monthly_sales_view,
trains a LinearRegression model per (device, store) pair,
writes predictions to the forecasts table, and logs the run
in automation_logs.

Usage:
  cd python
  python scripts/run_forecast.py [--store STORE_ID] [--months N]

Requirements:
  pip install supabase pandas scikit-learn python-dotenv python-dateutil
"""

import sys
import os
import argparse
from datetime import datetime
from typing import Optional

# Add the python folder to the import path.
# This lets the script import config, utils, and models when it is run directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# pandas is used to organize tabular sales data.
import pandas as pd

from dateutil.relativedelta import relativedelta

# Import shared configuration and helper functions.
from config import LOOKBACK_MONTHS, MODEL_VERSION
from utils.db import get_supabase_client
from models.forecaster import prepare_features, predict_next_month


# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg: str):
    """Print a message with the current time so the run is easy to follow."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def get_date_range(lookback_months: int):
    """
    Calculate the training start date and the forecast period.

    Example:
    If today is May 2026 and lookback is 6 months:
    - start date becomes November 1, 2025
    - forecast period becomes June 1, 2026
    """
    # Current date when the script is running.
    today = datetime.now()

    # Start from the first day of the month after subtracting the lookback period.
    start = (today - relativedelta(months=lookback_months)).replace(day=1)

    # Forecast is for the first day of next month.
    forecast_period = (today + relativedelta(months=1)).replace(day=1)

    # Return dates as strings because Supabase stores dates in text/date format.
    return start.strftime("%Y-%m-%d"), forecast_period.strftime("%Y-%m-%d")


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run_forecast(store_filter: Optional[str] = None, lookback: int = LOOKBACK_MONTHS):
    """
    Run the full demand forecasting pipeline.

    This function:
    1. connects to Supabase
    2. reads historical monthly sales
    3. groups data by device and store
    4. trains a simple forecasting model
    5. writes results to the forecasts table
    6. logs the run in automation_logs
    """
    # Create Supabase client using the service role key.
    client = get_supabase_client()

    # Save start time so automation_logs can record how long the run took.
    start_at = datetime.now()

    # Calculate which historical sales rows to use and which month to predict.
    start_date, forecast_period = get_date_range(lookback)
    log(f"Lookback from:   {start_date}")
    log(f"Forecast period: {forecast_period}")
    log(f"Model version:   {MODEL_VERSION}")
    if store_filter:
        log(f"Store filter:    {store_filter}")

    # ── 1. Fetch historical monthly sales ─────────────────────────────────────
    log("Fetching historical sales from monthly_sales_view…")

    # monthly_sales_view already summarizes sales by month, store, and device.
    # This is better than loading every sale item one by one.
    query = (
        client.from_("monthly_sales_view")
        .select("store_id, store_name, device_id, device_name, sale_month, total_units_sold")
        .gte("sale_month", start_date)
    )

    # Optional filter: forecast only one store if a store UUID is provided.
    if store_filter:
        query = query.eq("store_id", store_filter)

    # Run the Supabase query.
    response = query.execute()

    # If there is no sales history, the script cannot train a forecast.
    if not response.data:
        log("No sales data found. Exiting.")
        _log_run(client, "forecast", "no_data", 0, 0, start_at, {"reason": "no sales data"})
        return

    # Convert Supabase response into a pandas DataFrame.
    # DataFrame makes grouping and cleaning easier.
    df = pd.DataFrame(response.data)

    # Convert sale_month to real datetime values.
    df["sale_month"] = pd.to_datetime(df["sale_month"])

    # Convert total_units_sold to numbers.
    # Invalid values become 0 instead of crashing the script.
    df["total_units_sold"] = pd.to_numeric(df["total_units_sold"], errors="coerce").fillna(0)

    log(f"Loaded {len(df)} monthly rows across {df['device_id'].nunique()} devices / {df['store_id'].nunique()} stores.")

    # ── 2. Fetch all active stores (for global forecasts too) ─────────────────
    # This step is intentionally left in the database design, but this script
    # mainly forecasts from sales rows. If future logic needs active store
    # validation, it can be added here.

    # ── 3. Forecast per (device, store) ───────────────────────────────────────
    # Each device-store pair gets its own forecast.
    # Example: iPhone 15 at City Centre is separate from iPhone 15 at Riffa.
    groups = df.groupby(["device_id", "store_id"])
    total_groups = len(groups)
    log(f"Running forecasts for {total_groups} (device, store) pairs…")

    upserts = []
    skipped = 0

    for (device_id, store_id), group in groups:
        # Need at least 2 monthly data points for regression.
        # With only 1 point, the model cannot learn a trend.
        if len(group) < 2:
            skipped += 1
            continue

        # Sort this group by month before preparing model features.
        group_sorted = group.sort_values("sale_month").copy()

        # The model expects the target column to be named total_quantity.
        group_sorted["total_quantity"] = group_sorted["total_units_sold"]

        try:
            # Convert sales history into X and y arrays.
            X, y = prepare_features(group_sorted)

            # Predict next month and get confidence score.
            prediction, confidence_pct = predict_next_month(X, y)
            confidence_score = round(confidence_pct, 2)
        except Exception as e:
            # If one device/store group fails, skip it and continue others.
            log(f"  ⚠  Skipping device={device_id} store={store_id}: {e}")
            skipped += 1
            continue

        # Store one forecast row for this device-store pair.
        upserts.append({
            "device_id": device_id,
            "store_id": store_id,
            "forecast_period": forecast_period,
            "predicted_quantity": int(prediction),
            "confidence_score": float(confidence_score),
            "model_version": MODEL_VERSION,
            "notes": f"Trained on {len(group)} months of data",
        })

    # ── 4. Also produce a global (store_id=NULL) forecast per device ──────────
    # Global forecast means demand for the device across all stores combined.
    # store_id is NULL so the app knows this is not tied to one branch.
    global_groups = df.groupby("device_id")
    global_upserts_count = 0

    for device_id, group in global_groups:
        # Combine all stores for this device by month.
        agg = (
            group.groupby("sale_month")["total_units_sold"]
            .sum()
            .reset_index()
            .rename(columns={"total_units_sold": "total_quantity"})
            .sort_values("sale_month")
        )

        # Again, at least 2 months are needed.
        if len(agg) < 2:
            continue
        try:
            # Train and predict using the global monthly totals.
            X, y = prepare_features(agg)
            prediction, confidence_pct = predict_next_month(X, y)
        except Exception:
            continue

        # Add the global forecast row.
        upserts.append({
            "device_id": device_id,
            "store_id": None,
            "forecast_period": forecast_period,
            "predicted_quantity": int(prediction),
            "confidence_score": round(confidence_pct, 2),
            "model_version": MODEL_VERSION,
            "notes": f"Global aggregate — {len(agg)} months",
        })
        global_upserts_count += 1

    if not upserts:
        # No output means there was not enough useful history.
        log("No forecasts generated (insufficient data). Exiting.")
        _log_run(client, "forecast", "no_data", total_groups, 0, start_at, {"skipped": skipped})
        return

    # ── 5. Replace rows in forecasts table ────────────────────────────────────
    log(f"Writing {len(upserts)} forecast rows ({global_upserts_count} global)…")

    # Batch in chunks of 200 to avoid very large Supabase requests.
    BATCH = 200
    total_written = 0
    errors = []

    for i in range(0, len(upserts), BATCH):
        chunk = upserts[i : i + BATCH]
        try:
            for row in chunk:
                # Delete existing forecast for the same device, store, and period.
                # This prevents duplicate forecast rows.
                delete_query = (
                    client.from_("forecasts")
                    .delete()
                    .eq("device_id", row["device_id"])
                    .eq("forecast_period", row["forecast_period"])
                )

                # Global forecasts use store_id = NULL.
                if row["store_id"] is None:
                    delete_query = delete_query.is_("store_id", "null")
                else:
                    delete_query = delete_query.eq("store_id", row["store_id"])

                delete_query.execute()

            # Insert the fresh forecast rows for this batch.
            client.from_("forecasts").insert(chunk).execute()
            total_written += len(chunk)
        except Exception as e:
            errors.append(str(e))
            log(f"  ✗ Batch {i//BATCH + 1} failed: {e}")

    log(f"Written: {total_written} rows, Skipped: {skipped}, Errors: {len(errors)}")

    # ── 6. Log the run ────────────────────────────────────────────────────────
    # Store success/error details in automation_logs for traceability.
    status = "error" if errors else "success"
    _log_run(
        client,
        "forecast",
        status,
        records_processed=total_groups,
        records_created=total_written,
        start_at=start_at,
        details={
            "lookback_months": lookback,
            "forecast_period": forecast_period,
            "model_version": MODEL_VERSION,
            "skipped": skipped,
            "global_forecasts": global_upserts_count,
            "errors": errors[:5],  # cap at 5 for log size
        },
    )

    log(f"✅  Forecast run complete — status: {status}")


def _log_run(
    client,
    automation_type: str,
    status: str,
    records_processed: int,
    records_created: int,
    start_at: datetime,
    details: dict,
):
    """
    Insert a row into automation_logs.

    This helps the dashboard show whether automation jobs worked,
    how many records were processed, and whether errors occurred.
    """
    try:
        client.from_("automation_logs").insert({
            "automation_type": automation_type,
            "status": status,
            "records_processed": records_processed,
            "records_created": records_created,
            "details": details,
            "started_at": start_at.isoformat(),
            "completed_at": datetime.now().isoformat(),
        }).execute()
    except Exception as e:
        # Forecasts should not crash only because the log insert failed.
        log(f"  ⚠  Could not write automation log: {e}")


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Command line options make the script flexible during testing.
    parser = argparse.ArgumentParser(description="Run demand forecasting pipeline")
    parser.add_argument("--store", type=str, default=None, help="Limit to a specific store UUID")
    parser.add_argument("--months", type=int, default=LOOKBACK_MONTHS, help="Lookback period in months")
    args = parser.parse_args()

    run_forecast(store_filter=args.store, lookback=args.months)
