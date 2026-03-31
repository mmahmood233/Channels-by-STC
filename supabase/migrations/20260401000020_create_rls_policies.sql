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
