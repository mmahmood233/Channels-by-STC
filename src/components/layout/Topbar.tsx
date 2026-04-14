"use client";

import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { DarkModeToggle } from "@/components/ui/DarkModeToggle";
import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import type { UserRole } from "@/types";

function deriveTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/devices")) return "Devices";
  if (pathname.startsWith("/inventory")) return "Inventory";
  if (pathname.startsWith("/sales")) return "Sales";
  if (pathname.startsWith("/transfers")) return "Transfers";
  if (pathname.startsWith("/alerts")) return "Alerts";
  if (pathname.startsWith("/forecasts")) return "Forecasts";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/restock")) return "AI Restock";
  if (pathname.startsWith("/audit-logs")) return "Audit Logs";
  if (pathname.startsWith("/chatbot")) return "AI Chatbot";
  if (pathname.startsWith("/users")) return "Users";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

interface TopbarProps {
  onMobileMenuOpen: () => void;
  alertCount?: number;
  userId: string;
  storeId: string | null;
  userRole: UserRole;
}

export function Topbar({ onMobileMenuOpen, alertCount = 0, userId, storeId, userRole }: TopbarProps) {
  const pathname = usePathname();
  const pageTitle = deriveTitle(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-surface-100 bg-white px-4 lg:px-6">
      {/* Mobile menu toggle */}
      <button
        onClick={onMobileMenuOpen}
        className="rounded-lg p-2 text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      <h1 className="text-lg font-semibold text-surface-900 lg:text-xl">
        {pageTitle}
      </h1>

      <div className="flex-1" />

      {/* Search — desktop */}
      <div className="hidden items-center gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm transition-colors focus-within:border-brand-300 focus-within:bg-white lg:flex">
        <Search className="h-4 w-4 shrink-0 text-surface-400" />
        <input
          type="search"
          placeholder="Search…"
          className="w-48 bg-transparent outline-none placeholder:text-surface-400"
        />
      </div>

      {/* Dark mode toggle */}
      <DarkModeToggle />

      {/* Notification center (replaces static bell) */}
      <NotificationCenter
        userId={userId}
        storeId={storeId}
        userRole={userRole}
        initialCount={alertCount}
      />
    </header>
  );
}
