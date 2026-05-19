-- File purpose: Creates atomic inventory transaction functions for sales, transfers, and stock changes.
-- ============================================================================
-- Migration: Inventory Transaction Functions
-- Description: Keeps sale and transfer stock changes atomic and role checked.
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_sale_atomic(UUID, DATE, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.void_sale_atomic(UUID, TEXT);
DROP FUNCTION IF EXISTS public.complete_transfer_atomic(UUID);
DROP FUNCTION IF EXISTS public.create_transfer_atomic(UUID, UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.create_sale_atomic(
  p_store_id UUID,
  p_sale_date DATE,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role user_role;
  v_store_id UUID;
  v_sale_id UUID;
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_device_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC(12,2);
  v_available INTEGER;
BEGIN
  SELECT role, store_id INTO v_role, v_store_id
  FROM profiles
  WHERE id = v_user_id AND status = 'active';

  IF v_user_id IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_role = 'warehouse_manager'::user_role THEN
    RAISE EXCEPTION 'Warehouse managers cannot create sales';
  END IF;

  IF v_role = 'store_manager'::user_role AND v_store_id IS DISTINCT FROM p_store_id THEN
    RAISE EXCEPTION 'Store managers can only create sales for their assigned store';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one item';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_device_id := (v_item->>'device_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive';
    END IF;
    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;

    SELECT quantity INTO v_available
    FROM inventory
    WHERE store_id = p_store_id AND device_id = v_device_id
    FOR UPDATE;

    IF COALESCE(v_available, 0) < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for device %. Available: %, requested: %',
        v_device_id, COALESCE(v_available, 0), v_quantity;
    END IF;

    v_total := v_total + (v_quantity * v_unit_price);
  END LOOP;

  INSERT INTO sales (store_id, sold_by, sale_date, total_amount, notes)
  VALUES (p_store_id, v_user_id, p_sale_date, v_total, NULLIF(p_notes, ''))
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_device_id := (v_item->>'device_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    INSERT INTO sale_items (sale_id, device_id, quantity, unit_price, line_total)
    VALUES (v_sale_id, v_device_id, v_quantity, v_unit_price, v_quantity * v_unit_price);

    UPDATE inventory
    SET quantity = quantity - v_quantity
    WHERE store_id = p_store_id AND device_id = v_device_id;

    INSERT INTO stock_movements (
      store_id, device_id, movement_type, quantity, reference_type, reference_id, performed_by
    )
    VALUES (
      p_store_id, v_device_id, 'sale'::movement_type, -v_quantity, 'sale', v_sale_id, v_user_id
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_sale_atomic(
  p_sale_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role user_role;
  v_sale RECORD;
  v_item RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND status = 'active';

  IF v_user_id IS NULL OR v_role <> 'admin'::user_role THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT id, store_id, notes
  INTO v_sale
  FROM sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF COALESCE(v_sale.notes, '') LIKE '[VOIDED]%' THEN
    RAISE EXCEPTION 'Sale already voided';
  END IF;

  FOR v_item IN
    SELECT device_id, quantity
    FROM sale_items
    WHERE sale_id = p_sale_id
  LOOP
    INSERT INTO inventory (store_id, device_id, quantity)
    VALUES (v_sale.store_id, v_item.device_id, v_item.quantity)
    ON CONFLICT (store_id, device_id)
    DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity;

    INSERT INTO stock_movements (
      store_id, device_id, movement_type, quantity, reference_type, reference_id, notes, performed_by
    )
    VALUES (
      v_sale.store_id, v_item.device_id, 'return'::movement_type, v_item.quantity,
      'sale_void', p_sale_id, 'Voided sale - ' || p_reason, v_user_id
    );
  END LOOP;

  UPDATE sales
  SET notes = '[VOIDED] ' || p_reason
  WHERE id = p_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_transfer_atomic(
  p_transfer_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role user_role;
  v_transfer RECORD;
  v_item RECORD;
  v_available INTEGER;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND status = 'active';

  IF v_user_id IS NULL OR v_role NOT IN ('admin'::user_role, 'warehouse_manager'::user_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT id, source_store_id, destination_store_id, status
  INTO v_transfer
  FROM transfers
  WHERE id = p_transfer_id AND status = 'in_transit'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found or not in transit';
  END IF;

  FOR v_item IN
    SELECT device_id, quantity
    FROM transfer_items
    WHERE transfer_id = p_transfer_id
  LOOP
    SELECT quantity INTO v_available
    FROM inventory
    WHERE store_id = v_transfer.source_store_id AND device_id = v_item.device_id
    FOR UPDATE;

    IF COALESCE(v_available, 0) < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock at source store for device %', v_item.device_id;
    END IF;

    UPDATE inventory
    SET quantity = quantity - v_item.quantity
    WHERE store_id = v_transfer.source_store_id AND device_id = v_item.device_id;

    INSERT INTO inventory (store_id, device_id, quantity)
    VALUES (v_transfer.destination_store_id, v_item.device_id, v_item.quantity)
    ON CONFLICT (store_id, device_id)
    DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity;

    INSERT INTO stock_movements (
      store_id, device_id, movement_type, quantity, reference_type, reference_id, performed_by
    )
    VALUES
      (v_transfer.source_store_id, v_item.device_id, 'transfer_out'::movement_type, -v_item.quantity, 'transfer', p_transfer_id, v_user_id),
      (v_transfer.destination_store_id, v_item.device_id, 'transfer_in'::movement_type, v_item.quantity, 'transfer', p_transfer_id, v_user_id);
  END LOOP;

  UPDATE transfers
  SET status = 'completed', transfer_date = CURRENT_DATE
  WHERE id = p_transfer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transfer_atomic(
  p_source_store_id UUID,
  p_destination_store_id UUID,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role user_role;
  v_store_id UUID;
  v_source_is_warehouse BOOLEAN;
  v_transfer_id UUID;
  v_item JSONB;
  v_device_id UUID;
  v_quantity INTEGER;
BEGIN
  SELECT role, store_id INTO v_role, v_store_id
  FROM profiles
  WHERE id = v_user_id AND status = 'active';

  IF v_user_id IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_source_store_id = p_destination_store_id THEN
    RAISE EXCEPTION 'Source and destination must be different';
  END IF;

  IF v_role = 'store_manager'::user_role AND v_store_id IS DISTINCT FROM p_destination_store_id THEN
    RAISE EXCEPTION 'Store managers can only request transfers to their assigned store';
  END IF;

  IF v_role = 'store_manager'::user_role THEN
    SELECT is_warehouse INTO v_source_is_warehouse
    FROM stores
    WHERE id = p_source_store_id AND status = 'active';

    IF COALESCE(v_source_is_warehouse, false) = false THEN
      RAISE EXCEPTION 'Store managers can only request transfers from the warehouse';
    END IF;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one item';
  END IF;

  INSERT INTO transfers (
    source_store_id, destination_store_id, requested_by, status, notes
  )
  VALUES (
    p_source_store_id, p_destination_store_id, v_user_id, 'pending', NULLIF(p_notes, '')
  )
  RETURNING id INTO v_transfer_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_device_id := (v_item->>'device_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive';
    END IF;

    INSERT INTO transfer_items (transfer_id, device_id, quantity)
    VALUES (v_transfer_id, v_device_id, v_quantity);
  END LOOP;

  RETURN v_transfer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale_atomic(UUID, DATE, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale_atomic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_transfer_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transfer_atomic(UUID, UUID, TEXT, JSONB) TO authenticated;
