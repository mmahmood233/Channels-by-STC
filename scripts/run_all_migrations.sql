-- ============================================================================
-- Migration: Create Enums
-- Description: All PostgreSQL enum types used across the database
-- ============================================================================

-- User roles in the system
CREATE TYPE user_role AS ENUM (
  'admin',
  'store_manager',
  'warehouse_manager'
);

-- Profile account status
CREATE TYPE profile_status AS ENUM (
  'active',
  'inactive'
);

-- Store/warehouse location status
CREATE TYPE location_status AS ENUM (
  'active',
  'inactive'
);

-- Device/product lifecycle status
CREATE TYPE device_status AS ENUM (
  'active',
  'discontinued'
);

-- Types of stock movements for audit trail
CREATE TYPE movement_type AS ENUM (
  'sale',           -- stock out due to a sale
  'transfer_in',    -- stock in from another location
  'transfer_out',   -- stock out to another location
  'restock',        -- stock in from supplier/external source
  'adjustment',     -- manual correction (positive or negative)
  'return'          -- stock in from a customer return
);

-- Transfer workflow statuses
CREATE TYPE transfer_status AS ENUM (
  'pending',        -- transfer requested, awaiting approval
  'approved',       -- approved but not yet shipped
  'in_transit',     -- stock has left source, not yet received
  'completed',      -- stock received at destination
  'cancelled'       -- transfer was cancelled
);

-- Alert classification types
CREATE TYPE alert_type AS ENUM (
  'low_stock',            -- stock below threshold
  'out_of_stock',         -- stock at zero
  'overstock',            -- stock unusually high
  'forecast_warning',     -- forecast predicts a future shortage
  'restock_suggestion'    -- system suggests a restock action
);

-- Alert severity levels
CREATE TYPE alert_severity AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Alert lifecycle statuses
CREATE TYPE alert_status AS ENUM (
  'active',        -- new alert, needs attention
  'acknowledged',  -- user has seen it, not resolved
  'resolved',      -- underlying issue has been fixed
  'dismissed'      -- user chose to ignore it
);

-- Chatbot interaction result statuses
CREATE TYPE chatbot_status AS ENUM (
  'success',   -- question answered successfully
  'error',     -- something went wrong
  'timeout',   -- OpenAI took too long
  'no_data'    -- query returned no matching data
);
-- ============================================================================
-- Migration: Create Helper Functions
-- Description: Utility functions used by triggers across all tables
-- ============================================================================

-- Automatically sets updated_at to current timestamp on row update.
-- Applied via BEFORE UPDATE trigger on every table that has an updated_at column.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- Migration: Create Stores Table
-- Description: Retail branches and warehouse locations.
--              The warehouse is stored as a row with is_warehouse = TRUE.
-- ============================================================================

CREATE TABLE stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  region      TEXT,
  phone       TEXT,
  is_warehouse BOOLEAN NOT NULL DEFAULT FALSE,
  status      location_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_stores_name UNIQUE (name),
  CONSTRAINT uq_stores_code UNIQUE (code)
);

-- Only one warehouse can exist in the system
CREATE UNIQUE INDEX uq_stores_single_warehouse
  ON stores (is_warehouse) WHERE is_warehouse = TRUE;

-- Auto-update updated_at on modification
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ============================================================================
-- Migration: Create Categories Table
-- Description: Device/product categories for grouping and filtering
-- ============================================================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_categories_name UNIQUE (name)
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ============================================================================
-- Migration: Create Profiles Table
-- Description: Application-level user data linked to Supabase auth.users.
--              Every auth user gets a corresponding profile row.
-- ============================================================================

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'store_manager',
  store_id        UUID REFERENCES stores(id) ON DELETE SET NULL,
  phone           TEXT,
  avatar_url      TEXT,
  status          profile_status NOT NULL DEFAULT 'active',
  last_sign_in_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_profiles_email UNIQUE (email)
);

CREATE INDEX idx_profiles_store_id ON profiles(store_id);
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ============================================================================
-- Migration: Create Devices Table
-- Description: Product catalog - every device the company sells
-- ============================================================================

CREATE TABLE devices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 TEXT NOT NULL,
  name                TEXT NOT NULL,
  brand               TEXT NOT NULL,
  category_id         UUID NOT NULL REFERENCES categories(id),
  unit_price          NUMERIC(12,2) NOT NULL,
  cost_price          NUMERIC(12,2),
  description         TEXT,
  image_url           TEXT,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  status              device_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_devices_sku UNIQUE (sku),
  CONSTRAINT chk_devices_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT chk_devices_cost_price_non_negative CHECK (cost_price >= 0),
  CONSTRAINT chk_devices_threshold_non_negative  CHECK (low_stock_threshold >= 0)
);

CREATE INDEX idx_devices_category_id ON devices(category_id);
CREATE INDEX idx_devices_brand ON devices(brand);
CREATE INDEX idx_devices_status ON devices(status);

CREATE TRIGGER trg_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ============================================================================
-- Migration: Create Inventory Table
-- Description: Current stock quantity of each device at each location.
--              One row per (store, device) combination.
-- ============================================================================

CREATE TABLE inventory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id),
  device_id  UUID NOT NULL REFERENCES devices(id),
  quantity   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_inventory_store_device UNIQUE (store_id, device_id),
  CONSTRAINT chk_inventory_quantity_non_negative CHECK (quantity >= 0)
);

CREATE INDEX idx_inventory_store_id ON inventory(store_id);
CREATE INDEX idx_inventory_device_id ON inventory(device_id);

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ============================================================================
-- Migration: Create Stock Movements Table
-- Description: Append-only audit log of every inventory change.
--              Every time inventory.quantity changes, a row is inserted here.
-- ============================================================================

CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id),
  device_id       UUID NOT NULL REFERENCES devices(id),
  movement_type   movement_type NOT NULL,
  quantity        INTEGER NOT NULL,
  reference_type  TEXT,          -- 'sale', 'transfer', 'manual', etc.
  reference_id    UUID,          -- ID of the related sale, transfer, or other record
  notes           TEXT,
  performed_by    UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_stock_movements_quantity_not_zero CHECK (quantity != 0)
);

CREATE INDEX idx_stock_movements_store_id ON stock_movements(store_id);
CREATE INDEX idx_stock_movements_device_id ON stock_movements(device_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
-- ============================================================================
-- Migration: Create Sales and Sale Items Tables
-- Description: Sales header + line items (normalized design).
--              A sale can contain multiple devices.
-- ============================================================================

-- Sales header - one row per transaction
CREATE TABLE sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id),
  sold_by      UUID REFERENCES profiles(id),
  sale_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_sales_total_non_negative CHECK (total_amount >= 0)
);

CREATE INDEX idx_sales_store_id ON sales(store_id);
CREATE INDEX idx_sales_sale_date ON sales(sale_date);
CREATE INDEX idx_sales_sold_by ON sales(sold_by);
CREATE INDEX idx_sales_store_date ON sales(store_id, sale_date);

CREATE TRIGGER trg_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sale line items - one row per device per sale
CREATE TABLE sale_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id    UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  device_id  UUID NOT NULL REFERENCES devices(id),
  quantity   INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_sale_items_quantity_positive    CHECK (quantity > 0),
  CONSTRAINT chk_sale_items_unit_price_non_neg   CHECK (unit_price >= 0),
  CONSTRAINT chk_sale_items_line_total_non_neg   CHECK (line_total >= 0)
);

CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_device_id ON sale_items(device_id);
-- ============================================================================
-- Migration: Create Transfers and Transfer Items Tables
-- Description: Stock transfer requests between locations.
--              A transfer can contain multiple devices.
-- ============================================================================

-- Transfer header
CREATE TABLE transfers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_store_id       UUID NOT NULL REFERENCES stores(id),
  destination_store_id  UUID NOT NULL REFERENCES stores(id),
  requested_by          UUID NOT NULL REFERENCES profiles(id),
  approved_by           UUID REFERENCES profiles(id),
  status                transfer_status NOT NULL DEFAULT 'pending',
  notes                 TEXT,
  transfer_date         DATE,    -- set when status becomes 'completed'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_transfers_different_locations CHECK (source_store_id != destination_store_id)
);

CREATE INDEX idx_transfers_source ON transfers(source_store_id);
CREATE INDEX idx_transfers_destination ON transfers(destination_store_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_created_at ON transfers(created_at);

CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Transfer line items
CREATE TABLE transfer_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  device_id   UUID NOT NULL REFERENCES devices(id),
  quantity    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_transfer_items_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_transfer_items_transfer_id ON transfer_items(transfer_id);
CREATE INDEX idx_transfer_items_device_id ON transfer_items(device_id);
-- ============================================================================
-- Migration: Create Alerts Table
-- Description: System-generated alerts for low stock, forecast warnings,
--              and restock suggestions
-- ============================================================================

CREATE TABLE alerts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES stores(id),
  device_id        UUID REFERENCES devices(id),
  alert_type       alert_type NOT NULL,
  severity         alert_severity NOT NULL DEFAULT 'medium',
  status           alert_status NOT NULL DEFAULT 'active',
  title            TEXT NOT NULL,
  message          TEXT,
  current_quantity INTEGER,
  threshold        INTEGER,
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_store_id ON alerts(store_id);
CREATE INDEX idx_alerts_device_id ON alerts(device_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

CREATE TRIGGER trg_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ============================================================================
-- Migration: Create Forecasts Table
-- Description: Demand predictions generated by the Python forecasting module.
--              One row per device per store per forecast period.
--              store_id = NULL means a company-wide (global) forecast.
-- ============================================================================

CREATE TABLE forecasts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id          UUID NOT NULL REFERENCES devices(id),
  store_id           UUID REFERENCES stores(id),
  forecast_period    DATE NOT NULL,   -- first day of the forecasted month, e.g. '2026-05-01'
  predicted_quantity INTEGER NOT NULL,
  actual_quantity    INTEGER,          -- filled after the period ends for accuracy comparison
  confidence_score   NUMERIC(5,2),    -- percentage, e.g. 85.50
  model_version      TEXT,            -- e.g. 'v1.0-linear'
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_forecasts_predicted_non_negative CHECK (predicted_quantity >= 0),
  CONSTRAINT chk_forecasts_actual_non_negative    CHECK (actual_quantity >= 0),
  CONSTRAINT chk_forecasts_confidence_range       CHECK (confidence_score BETWEEN 0 AND 100)
);

-- Prevent duplicate forecasts for same device + store + period
-- This handles the case where store_id IS NOT NULL
CREATE UNIQUE INDEX uq_forecasts_device_store_period
  ON forecasts (device_id, store_id, forecast_period)
  WHERE store_id IS NOT NULL;

-- Separate unique index for global forecasts (store_id IS NULL)
-- because NULL != NULL in standard unique constraints
CREATE UNIQUE INDEX uq_forecasts_device_global_period
  ON forecasts (device_id, forecast_period)
  WHERE store_id IS NULL;

CREATE INDEX idx_forecasts_device_id ON forecasts(device_id);
CREATE INDEX idx_forecasts_store_id ON forecasts(store_id);
CREATE INDEX idx_forecasts_period ON forecasts(forecast_period);
CREATE INDEX idx_forecasts_device_period ON forecasts(device_id, forecast_period);
-- ============================================================================
-- Migration: Create Chatbot Logs Table
-- Description: Logs every AI chatbot interaction for auditing, debugging,
--              and usage analysis. Append-only - never updated or deleted.
-- ============================================================================

CREATE TABLE chatbot_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id),
  user_role         user_role NOT NULL,         -- snapshot of role at time of query
  store_id          UUID REFERENCES stores(id), -- store context if store manager
  question          TEXT NOT NULL,
  interpreted_intent TEXT,
  query_context     JSONB,                      -- data sent to OpenAI as context
  answer            TEXT,
  status            chatbot_status NOT NULL DEFAULT 'success',
  error_message     TEXT,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  response_time_ms  INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chatbot_logs_user_id ON chatbot_logs(user_id);
CREATE INDEX idx_chatbot_logs_created_at ON chatbot_logs(created_at);
-- ============================================================================
-- Migration: Create Audit Logs Table
-- Description: Records significant actions for accountability and traceability.
--              Append-only - never updated or deleted.
-- ============================================================================

CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id),   -- NULL for system-generated actions
  action     TEXT NOT NULL,                   -- e.g. 'device.created', 'transfer.approved'
  table_name TEXT,
  record_id  UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
-- ============================================================================
-- Migration: Create Automation Logs Table
-- Description: Records results of automated processes (forecast runs,
--              alert sweeps, restock suggestions). Append-only.
-- ============================================================================

CREATE TABLE automation_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type   TEXT NOT NULL,       -- e.g. 'forecast_run', 'alert_sweep'
  status            TEXT NOT NULL,       -- 'success', 'partial', 'failed'
  records_processed INTEGER,
  records_created   INTEGER,
  details           JSONB,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_logs_type ON automation_logs(automation_type);
CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at);
-- ============================================================================
-- Migration: Create Settings Table
-- Description: Key-value store for system-wide configuration and thresholds
-- ============================================================================

CREATE TABLE settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_settings_key UNIQUE (key)
);

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ============================================================================
-- Migration: Additional Indexes
-- Description: Any composite or specialized indexes not already created
--              in individual table migrations. Currently all indexes have
--              been included in their respective migrations, so this file
--              serves as a placeholder for future index additions.
-- ============================================================================

-- All primary indexes have been created in their respective table migrations.
-- Add future performance-related indexes here as the application grows.

-- Example of a future index:
-- CREATE INDEX idx_sale_items_device_sale_date
--   ON sale_items(device_id)
--   INCLUDE (quantity, line_total);
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
JOIN categories c ON d.category_id = c.id;


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
-- ============================================================================
-- Migration: Create RLS Helper Functions and Business Logic Functions
-- Description: Functions used by RLS policies and triggers.
--              SECURITY DEFINER so they can read profiles even when RLS is on.
-- ============================================================================

-- ── Role lookup ────────────────────────────────────────────────────────────
-- Returns the current authenticated user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the current authenticated user's assigned store ID
CREATE OR REPLACE FUNCTION public.get_my_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns TRUE if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ── Auth trigger function ──────────────────────────────────────────────────
-- Automatically creates a profile row when a new user signs up via Supabase Auth.
-- Reads full_name and role from raw_user_meta_data if provided.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'store_manager'
    ),
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Inventory safety trigger function ──────────────────────────────────────
-- Provides a descriptive error message when stock would go negative.
-- The CHECK constraint on inventory.quantity >= 0 is the hard enforcement;
-- this trigger gives a human-readable error instead of a raw constraint violation.
CREATE OR REPLACE FUNCTION public.check_inventory_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: "%" has only % units at "%", cannot reduce by %',
      (SELECT name FROM devices WHERE id = NEW.device_id),
      OLD.quantity,
      (SELECT name FROM stores WHERE id = NEW.store_id),
      (OLD.quantity - NEW.quantity);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- Migration: Enable RLS and Create Policies
-- Description: Row Level Security policies for all tables.
--              Deny-by-default: RLS enabled means zero rows returned
--              unless a policy explicitly grants access.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENABLE RLS ON ALL TABLES                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings        ENABLE ROW LEVEL SECURITY;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PROFILES                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Any authenticated user can read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admin can read all profiles
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- Admin can insert new profiles
CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

-- Admin can update any profile
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin');

-- Users can update their own profile (name, phone, avatar)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STORES                                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin has full access to stores
CREATE POLICY "stores_all_admin"
  ON stores FOR ALL
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view their own store
CREATE POLICY "stores_select_store_manager"
  ON stores FOR SELECT
  TO authenticated
  USING (get_my_role() = 'store_manager' AND id = get_my_store_id());

-- Warehouse manager can view all stores
CREATE POLICY "stores_select_warehouse_manager"
  ON stores FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  CATEGORIES                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- All authenticated users can view categories
CREATE POLICY "categories_select_all"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

-- Admin can manage categories
CREATE POLICY "categories_insert_admin"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "categories_update_admin"
  ON categories FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "categories_delete_admin"
  ON categories FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DEVICES                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- All authenticated users can view devices
CREATE POLICY "devices_select_all"
  ON devices FOR SELECT
  TO authenticated
  USING (true);

-- Admin can manage devices
CREATE POLICY "devices_insert_admin"
  ON devices FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "devices_update_admin"
  ON devices FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "devices_delete_admin"
  ON devices FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  INVENTORY                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin can view all inventory
CREATE POLICY "inventory_select_admin"
  ON inventory FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view their own store's inventory
CREATE POLICY "inventory_select_store_manager"
  ON inventory FOR SELECT
  TO authenticated
  USING (get_my_role() = 'store_manager' AND store_id = get_my_store_id());

-- Warehouse manager can view all inventory
CREATE POLICY "inventory_select_warehouse_manager"
  ON inventory FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');

-- Admin can insert/update inventory
CREATE POLICY "inventory_insert_admin"
  ON inventory FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "inventory_update_admin"
  ON inventory FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin');

-- Warehouse manager can insert/update inventory
CREATE POLICY "inventory_insert_warehouse_manager"
  ON inventory FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'warehouse_manager');

CREATE POLICY "inventory_update_warehouse_manager"
  ON inventory FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STOCK MOVEMENTS                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin can view all stock movements
CREATE POLICY "stock_movements_select_admin"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view movements for their store
CREATE POLICY "stock_movements_select_store_manager"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (get_my_role() = 'store_manager' AND store_id = get_my_store_id());

-- Warehouse manager can view all movements
CREATE POLICY "stock_movements_select_warehouse_manager"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');

-- Insert allowed for admin and warehouse manager (also via service role)
CREATE POLICY "stock_movements_insert_admin"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "stock_movements_insert_warehouse_manager"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'warehouse_manager');

CREATE POLICY "stock_movements_insert_store_manager"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'store_manager' AND store_id = get_my_store_id());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SALES                                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin full access
CREATE POLICY "sales_all_admin"
  ON sales FOR ALL
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view their own store's sales
CREATE POLICY "sales_select_store_manager"
  ON sales FOR SELECT
  TO authenticated
  USING (get_my_role() = 'store_manager' AND store_id = get_my_store_id());

-- Store manager can insert sales for their store
CREATE POLICY "sales_insert_store_manager"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'store_manager' AND store_id = get_my_store_id());

-- Store manager can update their own store's sales
CREATE POLICY "sales_update_store_manager"
  ON sales FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'store_manager' AND store_id = get_my_store_id());

-- Warehouse manager can view all sales (for planning)
CREATE POLICY "sales_select_warehouse_manager"
  ON sales FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SALE ITEMS                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin full access
CREATE POLICY "sale_items_all_admin"
  ON sale_items FOR ALL
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view sale items for sales at their store
CREATE POLICY "sale_items_select_store_manager"
  ON sale_items FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'store_manager'
    AND sale_id IN (SELECT id FROM sales WHERE store_id = get_my_store_id())
  );

-- Store manager can insert sale items for their store's sales
CREATE POLICY "sale_items_insert_store_manager"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'store_manager'
    AND sale_id IN (SELECT id FROM sales WHERE store_id = get_my_store_id())
  );

-- Warehouse manager can view all sale items (for planning)
CREATE POLICY "sale_items_select_warehouse_manager"
  ON sale_items FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  TRANSFERS                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin full access
CREATE POLICY "transfers_all_admin"
  ON transfers FOR ALL
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view transfers involving their store
CREATE POLICY "transfers_select_store_manager"
  ON transfers FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'store_manager'
    AND (source_store_id = get_my_store_id() OR destination_store_id = get_my_store_id())
  );

-- Store manager can request transfers to their store
CREATE POLICY "transfers_insert_store_manager"
  ON transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'store_manager'
    AND destination_store_id = get_my_store_id()
  );

-- Warehouse manager full access to transfers
CREATE POLICY "transfers_all_warehouse_manager"
  ON transfers FOR ALL
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  TRANSFER ITEMS                                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin full access
CREATE POLICY "transfer_items_all_admin"
  ON transfer_items FOR ALL
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view items for transfers involving their store
CREATE POLICY "transfer_items_select_store_manager"
  ON transfer_items FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'store_manager'
    AND transfer_id IN (
      SELECT id FROM transfers
      WHERE source_store_id = get_my_store_id()
         OR destination_store_id = get_my_store_id()
    )
  );

-- Store manager can insert items for transfers they created
CREATE POLICY "transfer_items_insert_store_manager"
  ON transfer_items FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'store_manager'
    AND transfer_id IN (
      SELECT id FROM transfers
      WHERE destination_store_id = get_my_store_id()
        AND requested_by = auth.uid()
    )
  );

-- Warehouse manager full access
CREATE POLICY "transfer_items_all_warehouse_manager"
  ON transfer_items FOR ALL
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ALERTS                                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin full access
CREATE POLICY "alerts_all_admin"
  ON alerts FOR ALL
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view alerts for their store
CREATE POLICY "alerts_select_store_manager"
  ON alerts FOR SELECT
  TO authenticated
  USING (get_my_role() = 'store_manager' AND store_id = get_my_store_id());

-- Store manager can update (acknowledge/dismiss) their store's alerts
CREATE POLICY "alerts_update_store_manager"
  ON alerts FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'store_manager' AND store_id = get_my_store_id());

-- Warehouse manager can view all alerts
CREATE POLICY "alerts_select_warehouse_manager"
  ON alerts FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');

-- Warehouse manager can update alerts
CREATE POLICY "alerts_update_warehouse_manager"
  ON alerts FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  FORECASTS                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin can view all forecasts
CREATE POLICY "forecasts_select_admin"
  ON forecasts FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- Store manager can view forecasts for their store + global forecasts
CREATE POLICY "forecasts_select_store_manager"
  ON forecasts FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'store_manager'
    AND (store_id = get_my_store_id() OR store_id IS NULL)
  );

-- Warehouse manager can view all forecasts
CREATE POLICY "forecasts_select_warehouse_manager"
  ON forecasts FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');

-- Forecasts are written by the Python service using service_role key (bypasses RLS).
-- Admin can also insert/update forecasts for manual adjustments.
CREATE POLICY "forecasts_insert_admin"
  ON forecasts FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "forecasts_update_admin"
  ON forecasts FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  CHATBOT LOGS                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Users can view their own chatbot logs
CREATE POLICY "chatbot_logs_select_own"
  ON chatbot_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin can view all chatbot logs
CREATE POLICY "chatbot_logs_select_admin"
  ON chatbot_logs FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- Users can insert their own chatbot logs
CREATE POLICY "chatbot_logs_insert_own"
  ON chatbot_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  AUDIT LOGS                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin can view all audit logs
CREATE POLICY "audit_logs_select_admin"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- Warehouse manager can view audit logs
CREATE POLICY "audit_logs_select_warehouse_manager"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');

-- Insert is done via service role or triggers; allow admin as fallback
CREATE POLICY "audit_logs_insert_admin"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  AUTOMATION LOGS                                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Admin can view all automation logs
CREATE POLICY "automation_logs_select_admin"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- Warehouse manager can view automation logs
CREATE POLICY "automation_logs_select_warehouse_manager"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (get_my_role() = 'warehouse_manager');

-- Insert via service role; admin fallback
CREATE POLICY "automation_logs_insert_admin"
  ON automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SETTINGS                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- All authenticated users can read settings
CREATE POLICY "settings_select_all"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can modify settings
CREATE POLICY "settings_insert_admin"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "settings_update_admin"
  ON settings FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "settings_delete_admin"
  ON settings FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');
-- ============================================================================
-- Migration: Create Auth Trigger and Inventory Safety Trigger
-- Description:
--   1. Auto-create profile when a new user signs up via Supabase Auth
--   2. Descriptive error on negative inventory
-- ============================================================================

-- ── Auth user created → auto-create profile ────────────────────────────────
CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Inventory safety trigger ───────────────────────────────────────────────
-- Provides a human-readable error instead of a raw CHECK constraint violation
CREATE TRIGGER trg_inventory_check_quantity
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION public.check_inventory_quantity();
