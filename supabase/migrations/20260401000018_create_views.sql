-- ============================================================================
-- Migration: Create Views
-- Description: SQL views for analytics, dashboards, and reporting.
--              Views inherit RLS from the underlying tables.
-- ============================================================================

-- ── Current Inventory View ─────────────────────────────────────────────────
-- Combines inventory, device, store, and category data.
-- Computes a stock_status label for each record.
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


-- ── Monthly Sales View ─────────────────────────────────────────────────────
-- Aggregated sales by store, device, and month.
-- Used by dashboards, analytics, and the forecasting module.
CREATE OR REPLACE VIEW monthly_sales_view AS
SELECT
  s.store_id,
  st.name                                  AS store_name,
  si.device_id,
  d.name                                   AS device_name,
  d.brand,
  DATE_TRUNC('month', s.sale_date)::DATE   AS sale_month,
  SUM(si.quantity)                          AS total_units_sold,
  SUM(si.line_total)                        AS total_revenue
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
JOIN devices d    ON si.device_id = d.id
JOIN stores st    ON s.store_id = st.id
GROUP BY s.store_id, st.name, si.device_id, d.name, d.brand,
         DATE_TRUNC('month', s.sale_date)::DATE;


-- ── Top Selling Devices View ───────────────────────────────────────────────
-- Ranks devices by total units sold (all time).
CREATE OR REPLACE VIEW top_selling_devices_view AS
SELECT
  si.device_id,
  d.name       AS device_name,
  d.brand,
  d.image_url,
  SUM(si.quantity)        AS total_units_sold,
  SUM(si.line_total)      AS total_revenue,
  COUNT(DISTINCT s.id)    AS total_transactions
FROM sale_items si
JOIN sales s   ON si.sale_id = s.id
JOIN devices d ON si.device_id = d.id
GROUP BY si.device_id, d.name, d.brand, d.image_url
ORDER BY total_units_sold DESC;


-- ── Low Stock View ─────────────────────────────────────────────────────────
-- All inventory records at or below threshold.
CREATE OR REPLACE VIEW low_stock_view AS
SELECT
  i.store_id,
  s.name                                   AS store_name,
  i.device_id,
  d.name                                   AS device_name,
  d.sku,
  i.quantity                               AS current_quantity,
  d.low_stock_threshold                    AS threshold,
  (d.low_stock_threshold - i.quantity)     AS units_below_threshold
FROM inventory i
JOIN stores s  ON i.store_id = s.id
JOIN devices d ON i.device_id = d.id
WHERE i.quantity <= d.low_stock_threshold
ORDER BY (d.low_stock_threshold - i.quantity) DESC;


-- ── Forecast vs Inventory View ─────────────────────────────────────────────
-- Compares forecasted demand against current stock.
-- Highlights potential shortages with a risk_level label.
CREATE OR REPLACE VIEW forecast_vs_inventory_view AS
SELECT
  f.id          AS forecast_id,
  f.device_id,
  d.name        AS device_name,
  f.store_id,
  s.name        AS store_name,
  f.forecast_period,
  f.predicted_quantity,
  COALESCE(i.quantity, 0)                              AS current_stock,
  COALESCE(i.quantity, 0) - f.predicted_quantity       AS stock_gap,
  CASE
    WHEN COALESCE(i.quantity, 0) >= f.predicted_quantity       THEN 'sufficient'
    WHEN COALESCE(i.quantity, 0) >= f.predicted_quantity * 0.5 THEN 'at_risk'
    ELSE 'shortage_expected'
  END AS risk_level,
  f.confidence_score,
  f.model_version
FROM forecasts f
JOIN devices d   ON f.device_id = d.id
LEFT JOIN stores s     ON f.store_id = s.id
LEFT JOIN inventory i  ON f.device_id = i.device_id AND f.store_id = i.store_id
WHERE f.forecast_period >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY stock_gap ASC;
