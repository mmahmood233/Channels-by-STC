"use client";

import { Menu, Bell, Search } from "lucide-react";
import { cn } from "@/utils/cn";

interface TopbarProps {
  pageTitle: string;
  onMobileMenuOpen: () => void;
  alertCount?: number;
}

export function Topbar({ pageTitle, onMobileMenuOpen, alertCount = 0 }: TopbarProps) {
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search — desktop */}
      <div className="hidden items-center gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-400 transition-colors hover:border-surface-300 focus-within:border-brand-300 focus-within:bg-white focus-within:text-surface-900 lg:flex">
        <Search className="h-4 w-4 shrink-0" />
        <input
          type="search"
          placeholder="Search…"
          className="w-48 bg-transparent outline-none placeholder:text-surface-400"
        />
      </div>

      {/* Alerts bell */}
      <button
        className="relative rounded-xl p-2 text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900"
        aria-label={`${alertCount} active alerts`}
      >
        <Bell className="h-5 w-5" />
        {alertCount > 0 && (
          <span
            className={cn(
              "absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white",
              alertCount > 9 && "w-5 rounded-full px-0.5"
            )}
          >
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </button>
    </header>
  );
}
