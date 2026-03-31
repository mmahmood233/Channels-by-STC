// Re-export all database types
export * from "./database";

// App-level types used across features

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: import("./database").UserRole[];
}

export interface DashboardStats {
  totalDevices: number;
  totalSales: number;
  totalRevenue: number;
  lowStockCount: number;
  activeAlerts: number;
  pendingTransfers: number;
}

export interface ChatbotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
