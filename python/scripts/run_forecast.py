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

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from dateutil.relativedelta import relativedelta

from config import LOOKBACK_MONTHS, MODEL_VERSION, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from utils.db import get_supabase_client
from models.forecaster import prepare_features, predict_next_month


# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def get_date_range(lookback_months: int):
    today = datetime.now()
    start = (today - relativedelta(months=lookback_months)).replace(day=1)
    forecast_period = (today + relativedelta(months=1)).replace(day=1)
    return start.strftime("%Y-%m-%d"), forecast_period.strftime("%Y-%m-%d")


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run_forecast(store_filter: str | None = None, lookback: int = LOOKBACK_MONTHS):
    client = get_supabase_client()
    start_at = datetime.now()

    start_date, forecast_period = get_date_range(lookback)
    log(f"Lookback from:   {start_date}")
    log(f"Forecast period: {forecast_period}")
    log(f"Model version:   {MODEL_VERSION}")
    if store_filter:
        log(f"Store filter:    {store_filter}")

    # ── 1. Fetch historical monthly sales ─────────────────────────────────────
    log("Fetching historical sales from monthly_sales_view…")
    query = (
        client.from_("monthly_sales_view")
        .select("store_id, store_name, device_id, device_name, sale_month, total_units_sold")
        .gte("sale_month", start_date)
    )
    if store_filter:
        query = query.eq("store_id", store_filter)

    response = query.execute()
    if not response.data:
        log("No sales data found. Exiting.")
        _log_run(client, "forecast", "no_data", 0, 0, start_at, {"reason": "no sales data"})
        return

    df = pd.DataFrame(response.data)
    df["sale_month"] = pd.to_datetime(df["sale_month"])
    df["total_units_sold"] = pd.to_numeric(df["total_units_sold"], errors="coerce").fillna(0)

    log(f"Loaded {len(df)} monthly rows across {df['device_id'].nunique()} devices / {df['store_id'].nunique()} stores.")

    # ── 2. Fetch all active stores (for global forecasts too) ─────────────────
    stores_resp = client.from_("stores").select("id, name").eq("status", "active").execute()
    store_ids = [s["id"] for s in (stores_resp.data or [])]

    # ── 3. Forecast per (device, store) ───────────────────────────────────────
    groups = df.groupby(["device_id", "store_id"])
    total_groups = len(groups)
    log(f"Running forecasts for {total_groups} (device, store) pairs…")

    upserts = []
    skipped = 0

    for (device_id, store_id), group in groups:
        # Need ≥ 2 data points for regression
        if len(group) < 2:
            skipped += 1
            continue

        # Align to monthly index
        group_sorted = group.sort_values("sale_month").copy()
        group_sorted["total_quantity"] = group_sorted["total_units_sold"]

        try:
            X, y = prepare_features(group_sorted)
            prediction, confidence_pct = predict_next_month(X, y)
            confidence_score = round(confidence_pct / 100, 4)
        except Exception as e:
            log(f"  ⚠  Skipping device={device_id} store={store_id}: {e}")
            skipped += 1
            continue

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
    global_groups = df.groupby("device_id")
    global_upserts_count = 0

    for device_id, group in global_groups:
        agg = (
            group.groupby("sale_month")["total_units_sold"]
            .sum()
            .reset_index()
            .rename(columns={"total_units_sold": "total_quantity"})
            .sort_values("sale_month")
        )
        if len(agg) < 2:
            continue
        try:
            X, y = prepare_features(agg)
            prediction, confidence_pct = predict_next_month(X, y)
        except Exception:
            continue

        upserts.append({
            "device_id": device_id,
            "store_id": None,
            "forecast_period": forecast_period,
            "predicted_quantity": int(prediction),
            "confidence_score": round(confidence_pct / 100, 4),
            "model_version": MODEL_VERSION,
            "notes": f"Global aggregate — {len(agg)} months",
        })
        global_upserts_count += 1

    if not upserts:
        log("No forecasts generated (insufficient data). Exiting.")
        _log_run(client, "forecast", "no_data", total_groups, 0, start_at, {"skipped": skipped})
        return

    # ── 5. Upsert into forecasts table ────────────────────────────────────────
    log(f"Upserting {len(upserts)} forecast rows ({global_upserts_count} global)…")

    # Batch in chunks of 200 to stay within request limits
    BATCH = 200
    total_written = 0
    errors = []

    for i in range(0, len(upserts), BATCH):
        chunk = upserts[i : i + BATCH]
        try:
            resp = (
                client.from_("forecasts")
                .upsert(
                    chunk,
                    on_conflict="device_id,store_id,forecast_period"
                    if any(r["store_id"] is not None for r in chunk)
                    else "device_id,forecast_period",
                )
                .execute()
            )
            total_written += len(chunk)
        except Exception as e:
            errors.append(str(e))
            log(f"  ✗ Batch {i//BATCH + 1} failed: {e}")

    log(f"Written: {total_written} rows, Skipped: {skipped}, Errors: {len(errors)}")

    # ── 6. Log the run ────────────────────────────────────────────────────────
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
        log(f"  ⚠  Could not write automation log: {e}")


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run demand forecasting pipeline")
    parser.add_argument("--store", type=str, default=None, help="Limit to a specific store UUID")
    parser.add_argument("--months", type=int, default=LOOKBACK_MONTHS, help="Lookback period in months")
    args = parser.parse_args()

    run_forecast(store_filter=args.store, lookback=args.months)
