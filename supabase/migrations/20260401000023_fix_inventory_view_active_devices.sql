-- ============================================================================
-- Migration: Fix current_inventory_view to exclude discontinued devices
-- Description: Adds WHERE d.status = 'active' so that deactivating a device
--              removes it from inventory, transfer, and sales dropdowns.
-- ============================================================================

CREATE OR REPLACE VIEW current_inventory_view AS
SELECT
  i.id         AS inventory_id,
  i.store_id,
  s.name       AS store_name,
  s.code       AS store_code,
  s.is_warehouse,
  i.device_id,
  d.sku,
  d.name       AS device_name,
  d.brand,
  c.name       AS category_name,
  d.unit_price,
  d.cost_price,
  i.quantity,
  d.low_stock_threshold,
  CASE
    WHEN i.quantity = 0 THEN 'out_of_stock'
    WHEN i.quantity <= d.low_stock_threshold THEN 'low_stock'
    ELSE 'in_stock'
  END AS stock_status,
  i.updated_at
FROM inventory i
JOIN stores s ON i.store_id = s.id
JOIN devices d ON i.device_id = d.id
JOIN categories c ON d.category_id = c.id
WHERE d.status = 'active';
