import type { UserRole } from "@/types";

// Application name
export const APP_NAME = "Smart Inventory System";
export const APP_DESCRIPTION =
  "Smart Inventory and Stock Automation System with AI Chatbots";

// Currency (Bahraini Dinar)
export const CURRENCY_CODE = "BHD";
export const CURRENCY_SYMBOL = "BD";

// Role display labels
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  store_manager: "Store Manager",
  warehouse_manager: "Warehouse Manager",
};

// Transfer status labels and colors
export const TRANSFER_STATUS_CONFIG = {
  pending: { label: "Pending", color: "yellow" },
  approved: { label: "Approved", color: "blue" },
  in_transit: { label: "In Transit", color: "purple" },
  completed: { label: "Completed", color: "green" },
  cancelled: { label: "Cancelled", color: "red" },
} as const;

// Alert severity labels and colors
export const ALERT_SEVERITY_CONFIG = {
  low: { label: "Low", color: "blue" },
  medium: { label: "Medium", color: "yellow" },
  high: { label: "High", color: "orange" },
  critical: { label: "Critical", color: "red" },
} as const;

// Alert status labels
export const ALERT_STATUS_CONFIG = {
  active: { label: "Active", color: "red" },
  acknowledged: { label: "Acknowledged", color: "yellow" },
  resolved: { label: "Resolved", color: "green" },
  dismissed: { label: "Dismissed", color: "gray" },
} as const;

// Stock status labels
export const STOCK_STATUS_CONFIG = {
  in_stock: { label: "In Stock", color: "green" },
  low_stock: { label: "Low Stock", color: "yellow" },
  out_of_stock: { label: "Out of Stock", color: "red" },
} as const;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Routes
export const ROUTES = {
  LOGIN: "/login",
  FORGOT_PASSWORD: "/forgot-password",
  DASHBOARD: "/dashboard",
  DEVICES: "/devices",
  INVENTORY: "/inventory",
  SALES: "/sales",
  TRANSFERS: "/transfers",
  ALERTS: "/alerts",
  FORECASTS: "/forecasts",
  CHATBOT: "/chatbot",
  USERS: "/users",
  SETTINGS: "/settings",
} as const;
