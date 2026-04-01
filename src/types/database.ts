// This file will be replaced with auto-generated types from Supabase CLI.
// Run: npx supabase gen types typescript --local > src/types/database.ts
// For now, we define a minimal placeholder that avoids circular type references.

export type UserRole = "admin" | "store_manager" | "warehouse_manager";

// ── Row types (what you read from the database) ────────────────────────────

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  store_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: "active" | "inactive";
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  is_warehouse: boolean;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceRow {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category_id: string;
  unit_price: number;
  cost_price: number | null;
  description: string | null;
  image_url: string | null;
  low_stock_threshold: number;
  status: "active" | "discontinued";
  created_at: string;
  updated_at: string;
}

export interface InventoryRow {
  id: string;
  store_id: string;
  device_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovementRow {
  id: string;
  store_id: string;
  device_id: string;
  movement_type: "sale" | "transfer_in" | "transfer_out" | "restock" | "adjustment" | "return";
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface SaleRow {
  id: string;
  store_id: string;
  sold_by: string | null;
  sale_date: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItemRow {
  id: string;
  sale_id: string;
  device_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface TransferRow {
  id: string;
  source_store_id: string;
  destination_store_id: string;
  requested_by: string;
  approved_by: string | null;
  status: "pending" | "approved" | "in_transit" | "completed" | "cancelled";
  notes: string | null;
  transfer_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferItemRow {
  id: string;
  transfer_id: string;
  device_id: string;
  quantity: number;
  created_at: string;
}

export interface AlertRow {
  id: string;
  store_id: string;
  device_id: string | null;
  alert_type: "low_stock" | "out_of_stock" | "overstock" | "forecast_warning" | "restock_suggestion";
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "acknowledged" | "resolved" | "dismissed";
  title: string;
  message: string | null;
  current_quantity: number | null;
  threshold: number | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastRow {
  id: string;
  device_id: string;
  store_id: string | null;
  forecast_period: string;
  predicted_quantity: number;
  actual_quantity: number | null;
  confidence_score: number | null;
  model_version: string | null;
  notes: string | null;
  created_at: string;
}

export interface ChatbotLogRow {
  id: string;
  user_id: string;
  user_role: UserRole;
  store_id: string | null;
  question: string;
  interpreted_intent: string | null;
  query_context: Record<string, unknown> | null;
  answer: string | null;
  status: "success" | "error" | "timeout" | "no_data";
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AutomationLogRow {
  id: string;
  automation_type: string;
  status: string;
  records_processed: number | null;
  records_created: number | null;
  details: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface SettingRow {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── View row types ─────────────────────────────────────────────────────────

export interface CurrentInventoryViewRow {
  inventory_id: string;
  store_id: string;
  store_name: string;
  store_code: string;
  is_warehouse: boolean;
  device_id: string;
  sku: string;
  device_name: string;
  brand: string;
  category_name: string;
  unit_price: number;
  cost_price: number | null;
  quantity: number;
  low_stock_threshold: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  updated_at: string;
}

export interface LowStockViewRow {
  store_id: string;
  store_name: string;
  device_id: string;
  device_name: string;
  sku: string;
  current_quantity: number;
  threshold: number;
  units_below_threshold: number;
}

export interface ForecastVsInventoryViewRow {
  forecast_id: string;
  device_id: string;
  device_name: string;
  store_id: string | null;
  store_name: string | null;
  forecast_period: string;
  predicted_quantity: number;
  current_stock: number;
  stock_gap: number;
  risk_level: "sufficient" | "at_risk" | "shortage_expected";
  confidence_score: number | null;
  model_version: string | null;
}

export interface MonthlySalesViewRow {
  store_id: string;
  store_name: string;
  device_id: string;
  device_name: string;
  brand: string;
  sale_month: string;
  total_units_sold: number;
  total_revenue: number;
}

export interface TopSellingDeviceViewRow {
  device_id: string;
  device_name: string;
  brand: string;
  image_url: string | null;
  total_units_sold: number;
  total_revenue: number;
  total_transactions: number;
}

// ── Database type for Supabase client ──────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string; email: string; full_name: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      stores: {
        Row: StoreRow;
        Insert: Partial<StoreRow> & { name: string; code: string };
        Update: Partial<StoreRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Partial<CategoryRow> & { name: string };
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      devices: {
        Row: DeviceRow;
        Insert: Partial<DeviceRow> & { sku: string; name: string; brand: string; category_id: string; unit_price: number };
        Update: Partial<DeviceRow>;
        Relationships: [];
      };
      inventory: {
        Row: InventoryRow;
        Insert: Partial<InventoryRow> & { store_id: string; device_id: string };
        Update: Partial<InventoryRow>;
        Relationships: [];
      };
      stock_movements: {
        Row: StockMovementRow;
        Insert: Partial<StockMovementRow> & { store_id: string; device_id: string; movement_type: StockMovementRow["movement_type"]; quantity: number };
        Update: Partial<StockMovementRow>;
        Relationships: [];
      };
      sales: {
        Row: SaleRow;
        Insert: Partial<SaleRow> & { store_id: string };
        Update: Partial<SaleRow>;
        Relationships: [];
      };
      sale_items: {
        Row: SaleItemRow;
        Insert: Partial<SaleItemRow> & { sale_id: string; device_id: string; quantity: number; unit_price: number; line_total: number };
        Update: Partial<SaleItemRow>;
        Relationships: [];
      };
      transfers: {
        Row: TransferRow;
        Insert: Partial<TransferRow> & { source_store_id: string; destination_store_id: string; requested_by: string };
        Update: Partial<TransferRow>;
        Relationships: [];
      };
      transfer_items: {
        Row: TransferItemRow;
        Insert: Partial<TransferItemRow> & { transfer_id: string; device_id: string; quantity: number };
        Update: Partial<TransferItemRow>;
        Relationships: [];
      };
      alerts: {
        Row: AlertRow;
        Insert: Partial<AlertRow> & { store_id: string; alert_type: AlertRow["alert_type"]; title: string };
        Update: Partial<AlertRow>;
        Relationships: [];
      };
      forecasts: {
        Row: ForecastRow;
        Insert: Partial<ForecastRow> & { device_id: string; forecast_period: string; predicted_quantity: number };
        Update: Partial<ForecastRow>;
        Relationships: [];
      };
      chatbot_logs: {
        Row: ChatbotLogRow;
        Insert: Partial<ChatbotLogRow> & { user_id: string; user_role: UserRole; question: string };
        Update: Partial<ChatbotLogRow>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Partial<AuditLogRow> & { action: string };
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
      automation_logs: {
        Row: AutomationLogRow;
        Insert: Partial<AutomationLogRow> & { automation_type: string; status: string };
        Update: Partial<AutomationLogRow>;
        Relationships: [];
      };
      settings: {
        Row: SettingRow;
        Insert: Partial<SettingRow> & { key: string; value: string };
        Update: Partial<SettingRow>;
        Relationships: [];
      };
    };
    Views: {
      current_inventory_view: {
        Row: CurrentInventoryViewRow;
      };
      low_stock_view: {
        Row: LowStockViewRow;
      };
      forecast_vs_inventory_view: {
        Row: ForecastVsInventoryViewRow;
      };
      monthly_sales_view: {
        Row: MonthlySalesViewRow;
      };
      top_selling_devices_view: {
        Row: TopSellingDeviceViewRow;
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      profile_status: "active" | "inactive";
      location_status: "active" | "inactive";
      device_status: "active" | "discontinued";
      movement_type: "sale" | "transfer_in" | "transfer_out" | "restock" | "adjustment" | "return";
      transfer_status: "pending" | "approved" | "in_transit" | "completed" | "cancelled";
      alert_type: "low_stock" | "out_of_stock" | "overstock" | "forecast_warning" | "restock_suggestion";
      alert_severity: "low" | "medium" | "high" | "critical";
      alert_status: "active" | "acknowledged" | "resolved" | "dismissed";
      chatbot_status: "success" | "error" | "timeout" | "no_data";
    };
  };
};

// ── Convenience aliases ────────────────────────────────────────────────────

export type Profile = ProfileRow;
export type Store = StoreRow;
export type Category = CategoryRow;
export type Device = DeviceRow;
export type Inventory = InventoryRow;
export type StockMovement = StockMovementRow;
export type Sale = SaleRow;
export type SaleItem = SaleItemRow;
export type Transfer = TransferRow;
export type TransferItem = TransferItemRow;
export type Alert = AlertRow;
export type Forecast = ForecastRow;
export type ChatbotLog = ChatbotLogRow;
export type AuditLog = AuditLogRow;
export type AutomationLog = AutomationLogRow;
export type Setting = SettingRow;
