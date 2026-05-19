-- File purpose: Creates or updates Supabase database structure, policies, seed data, or backend logic.
-- ============================================================================
-- Migration: Complete Requirements Gaps
-- Description: Adds rejected transfers, atomic stock adjustments, and automatic
--              stock/forecast alert generation.
-- ============================================================================

ALTER TYPE transfer_status ADD VALUE IF NOT EXISTS 'rejected';

DROP FUNCTION IF EXISTS public.adjust_stock_atomic(UUID, UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.adjust_stock_atomic(
  p_store_id UUID,
  p_device_id UUID,
  p_adjustment INTEGER,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role user_role;
  v_inventory_id UUID;
  v_quantity INTEGER;
  v_new_quantity INTEGER;
BEGIN
  SELECT role INTO v_role
  FROM profiles
  WHERE id = v_user_id AND status = 'active';

  IF v_user_id IS NULL OR v_role NOT IN ('admin'::user_role, 'warehouse_manager'::user_role) THEN
    RAISE EXCEPTION 'Admin or warehouse manager only';
  END IF;

  IF p_adjustment = 0 THEN
    RAISE EXCEPTION 'Adjustment cannot be zero';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT id, quantity INTO v_inventory_id, v_quantity
  FROM inventory
  WHERE store_id = p_store_id AND device_id = p_device_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_adjustment < 0 THEN
      RAISE EXCEPTION 'No inventory record exists for this device at this store';
    END IF;

    INSERT INTO inventory (store_id, device_id, quantity)
    VALUES (p_store_id, p_device_id, p_adjustment)
    RETURNING quantity INTO v_new_quantity;
  ELSE
    v_new_quantity := v_quantity + p_adjustment;

    IF v_new_quantity < 0 THEN
      RAISE EXCEPTION 'Cannot reduce below 0. Current stock: %', v_quantity;
    END IF;

    UPDATE inventory
    SET quantity = v_new_quantity
    WHERE id = v_inventory_id;
  END IF;

  INSERT INTO stock_movements (
    store_id, device_id, movement_type, quantity, reference_type, notes, performed_by
  )
  VALUES (
    p_store_id, p_device_id, 'adjustment'::movement_type, p_adjustment,
    'manual_adjustment', p_reason, v_user_id
  );

  RETURN v_new_quantity;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, INTEGER, TEXT) TO authenticated;

WITH ranked_open_alerts AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id, device_id, alert_type
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM alerts
  WHERE status IN ('active', 'acknowledged')
)
UPDATE alerts
SET status = 'resolved', resolved_at = now()
WHERE id IN (
  SELECT id FROM ranked_open_alerts WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_open_alert_store_device_type
  ON alerts (store_id, device_id, alert_type)
  WHERE status IN ('active', 'acknowledged');

CREATE OR REPLACE FUNCTION public.sync_inventory_stock_alert(
  p_store_id UUID,
  p_device_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device RECORD;
  v_store_name TEXT;
  v_quantity INTEGER;
  v_alert_type alert_type;
  v_severity alert_severity;
  v_title TEXT;
  v_message TEXT;
BEGIN
  SELECT d.name, d.brand, d.low_stock_threshold, d.status
  INTO v_device
  FROM devices d
  WHERE d.id = p_device_id;

  IF NOT FOUND OR v_device.status <> 'active' THEN
    RETURN;
  END IF;

  SELECT name INTO v_store_name FROM stores WHERE id = p_store_id;

  SELECT quantity INTO v_quantity
  FROM inventory
  WHERE store_id = p_store_id AND device_id = p_device_id;

  v_quantity := COALESCE(v_quantity, 0);

  IF v_quantity = 0 THEN
    v_alert_type := 'out_of_stock'::alert_type;
    v_severity := 'critical'::alert_severity;
    v_title := v_device.brand || ' ' || v_device.name || ' is out of stock';
    v_message := COALESCE(v_store_name, 'Store') || ' has no remaining units.';

    UPDATE alerts
    SET status = 'resolved', resolved_at = now()
    WHERE store_id = p_store_id
      AND device_id = p_device_id
      AND alert_type = 'low_stock'::alert_type
      AND status IN ('active', 'acknowledged');
  ELSIF v_quantity <= v_device.low_stock_threshold THEN
    v_alert_type := 'low_stock'::alert_type;
    v_severity := CASE
      WHEN v_quantity <= GREATEST(1, FLOOR(v_device.low_stock_threshold * 0.25)) THEN 'high'::alert_severity
      ELSE 'medium'::alert_severity
    END;
    v_title := v_device.brand || ' ' || v_device.name || ' is low on stock';
    v_message := COALESCE(v_store_name, 'Store') || ' has ' || v_quantity || ' units remaining.';

    UPDATE alerts
    SET status = 'resolved', resolved_at = now()
    WHERE store_id = p_store_id
      AND device_id = p_device_id
      AND alert_type = 'out_of_stock'::alert_type
      AND status IN ('active', 'acknowledged');
  ELSE
    UPDATE alerts
    SET status = 'resolved', resolved_at = now()
    WHERE store_id = p_store_id
      AND device_id = p_device_id
      AND alert_type IN ('low_stock'::alert_type, 'out_of_stock'::alert_type)
      AND status IN ('active', 'acknowledged');
    RETURN;
  END IF;

  INSERT INTO alerts (
    store_id, device_id, alert_type, severity, status, title, message,
    current_quantity, threshold, resolved_at, resolved_by
  )
  VALUES (
    p_store_id, p_device_id, v_alert_type, v_severity, 'active',
    v_title, v_message, v_quantity, v_device.low_stock_threshold, NULL, NULL
  )
  ON CONFLICT (store_id, device_id, alert_type)
    WHERE status IN ('active', 'acknowledged')
  DO UPDATE SET
    severity = EXCLUDED.severity,
    status = 'active',
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    current_quantity = EXCLUDED.current_quantity,
    threshold = EXCLUDED.threshold,
    resolved_at = NULL,
    resolved_by = NULL,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_inventory_stock_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_inventory_stock_alert(NEW.store_id, NEW.device_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_sync_stock_alert ON inventory;
CREATE TRIGGER trg_inventory_sync_stock_alert
  AFTER INSERT OR UPDATE OF quantity ON inventory
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_inventory_stock_alert();

CREATE OR REPLACE FUNCTION public.sync_forecast_warning_alert(
  p_forecast_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_forecast RECORD;
BEGIN
  SELECT *
  INTO v_forecast
  FROM forecast_vs_inventory_view
  WHERE forecast_id = p_forecast_id;

  IF NOT FOUND OR v_forecast.store_id IS NULL THEN
    RETURN;
  END IF;

  IF v_forecast.risk_level = 'sufficient' THEN
    UPDATE alerts
    SET status = 'resolved', resolved_at = now()
    WHERE store_id = v_forecast.store_id
      AND device_id = v_forecast.device_id
      AND alert_type = 'forecast_warning'::alert_type
      AND status IN ('active', 'acknowledged');
    RETURN;
  END IF;

  INSERT INTO alerts (
    store_id, device_id, alert_type, severity, status, title, message,
    current_quantity, threshold, resolved_at, resolved_by
  )
  VALUES (
    v_forecast.store_id,
    v_forecast.device_id,
    'forecast_warning'::alert_type,
    CASE
      WHEN v_forecast.risk_level = 'shortage_expected' THEN 'high'::alert_severity
      ELSE 'medium'::alert_severity
    END,
    'active',
    v_forecast.device_name || ' forecast risk',
    'Predicted demand is ' || v_forecast.predicted_quantity ||
      ' units for ' || to_char(v_forecast.forecast_period, 'Mon YYYY') ||
      ', current stock is ' || v_forecast.current_stock || '.',
    v_forecast.current_stock,
    v_forecast.predicted_quantity,
    NULL,
    NULL
  )
  ON CONFLICT (store_id, device_id, alert_type)
    WHERE status IN ('active', 'acknowledged')
  DO UPDATE SET
    severity = EXCLUDED.severity,
    status = 'active',
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    current_quantity = EXCLUDED.current_quantity,
    threshold = EXCLUDED.threshold,
    resolved_at = NULL,
    resolved_by = NULL,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_forecast_warning_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_forecast_warning_alert(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forecasts_sync_warning_alert ON forecasts;
CREATE TRIGGER trg_forecasts_sync_warning_alert
  AFTER INSERT OR UPDATE OF predicted_quantity, forecast_period ON forecasts
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_forecast_warning_alert();

DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN SELECT store_id, device_id FROM inventory LOOP
    PERFORM public.sync_inventory_stock_alert(v_row.store_id, v_row.device_id);
  END LOOP;

  FOR v_row IN SELECT id FROM forecasts LOOP
    PERFORM public.sync_forecast_warning_alert(v_row.id);
  END LOOP;
END;
$$;
