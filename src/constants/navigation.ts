import type { NavItem } from "@/types";
import { ROUTES } from "./index";

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: ROUTES.DASHBOARD,
    icon: "LayoutDashboard",
    roles: ["admin", "store_manager", "warehouse_manager"],
  },
  {
    label: "Devices",
    href: ROUTES.DEVICES,
    icon: "Smartphone",
    roles: ["admin", "store_manager", "warehouse_manager"],
  },
  {
    label: "Inventory",
    href: ROUTES.INVENTORY,
    icon: "Package",
    roles: ["admin", "store_manager", "warehouse_manager"],
  },
  {
    label: "Sales",
    href: ROUTES.SALES,
    icon: "ShoppingCart",
    roles: ["admin", "store_manager", "warehouse_manager"],
  },
  {
    label: "Transfers",
    href: ROUTES.TRANSFERS,
    icon: "ArrowLeftRight",
    roles: ["admin", "store_manager", "warehouse_manager"],
  },
  {
    label: "Alerts",
    href: ROUTES.ALERTS,
    icon: "Bell",
    roles: ["admin", "store_manager", "warehouse_manager"],
  },
  {
    label: "Forecasts",
    href: ROUTES.FORECASTS,
    icon: "TrendingUp",
    roles: ["admin", "store_manager", "warehouse_manager"],
  },
  {
    label: "Chatbot",
    href: ROUTES.CHATBOT,
    icon: "MessageSquare",
    roles: ["admin", "store_manager", "warehouse_manager"],
  },
  {
    label: "Users",
    href: ROUTES.USERS,
    icon: "Users",
    roles: ["admin"],
  },
  {
    label: "Settings",
    href: ROUTES.SETTINGS,
    icon: "Settings",
    roles: ["admin"],
  },
];
