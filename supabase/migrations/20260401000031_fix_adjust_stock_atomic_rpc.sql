-- ============================================================================
-- Migration: Fix Stock Adjustment RPC
-- Description: Recreates the stock adjustment function and refreshes the
--              PostgREST schema cache so Supabase RPC can find it.
-- ============================================================================

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
    store_id,
    device_id,
    movement_type,
    quantity,
    reference_type,
    notes,
    performed_by
  )
  VALUES (
    p_store_id,
    p_device_id,
    'adjustment'::movement_type,
    p_adjustment,
    'manual_adjustment',
    p_reason,
    v_user_id
  );

  RETURN v_new_quantity;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
