-- ============================================================================
-- Migration: Audit Log Triggers
-- Description: Automatically records inserts, updates, and deletes on core
--              business tables so the Audit Logs page has real data.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_record_id UUID;
BEGIN
  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_user_id
  ) THEN
    v_user_id := NULL;
  END IF;

  v_record_id := COALESCE(
    CASE WHEN TG_OP <> 'DELETE' THEN (to_jsonb(NEW)->>'id')::UUID END,
    CASE WHEN TG_OP = 'DELETE' THEN (to_jsonb(OLD)->>'id')::UUID END
  );

  INSERT INTO audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  )
  VALUES (
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profiles ON profiles;
DROP TRIGGER IF EXISTS trg_audit_stores ON stores;
DROP TRIGGER IF EXISTS trg_audit_categories ON categories;
DROP TRIGGER IF EXISTS trg_audit_devices ON devices;
DROP TRIGGER IF EXISTS trg_audit_inventory ON inventory;
DROP TRIGGER IF EXISTS trg_audit_stock_movements ON stock_movements;
DROP TRIGGER IF EXISTS trg_audit_sales ON sales;
DROP TRIGGER IF EXISTS trg_audit_sale_items ON sale_items;
DROP TRIGGER IF EXISTS trg_audit_transfers ON transfers;
DROP TRIGGER IF EXISTS trg_audit_transfer_items ON transfer_items;
DROP TRIGGER IF EXISTS trg_audit_alerts ON alerts;
DROP TRIGGER IF EXISTS trg_audit_forecasts ON forecasts;
DROP TRIGGER IF EXISTS trg_audit_settings ON settings;

CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_stores
  AFTER INSERT OR UPDATE OR DELETE ON stores
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_devices
  AFTER INSERT OR UPDATE OR DELETE ON devices
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_inventory
  AFTER INSERT OR UPDATE OR DELETE ON inventory
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_stock_movements
  AFTER INSERT OR UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_sale_items
  AFTER INSERT OR UPDATE OR DELETE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_transfers
  AFTER INSERT OR UPDATE OR DELETE ON transfers
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_transfer_items
  AFTER INSERT OR UPDATE OR DELETE ON transfer_items
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_alerts
  AFTER INSERT OR UPDATE OR DELETE ON alerts
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_forecasts
  AFTER INSERT OR UPDATE OR DELETE ON forecasts
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

CREATE TRIGGER trg_audit_settings
  AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
VALUES (
  NULL,
  'INSERT',
  'audit_logs',
  NULL,
  NULL,
  jsonb_build_object(
    'message', 'Audit logging enabled',
    'tables', ARRAY[
      'profiles',
      'stores',
      'categories',
      'devices',
      'inventory',
      'stock_movements',
      'sales',
      'sale_items',
      'transfers',
      'transfer_items',
      'alerts',
      'forecasts',
      'settings'
    ]
  )
);
