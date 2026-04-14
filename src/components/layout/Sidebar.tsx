"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Smartphone,
  Package,
  ShoppingCart,
  ArrowLeftRight,
  Bell,
  TrendingUp,
  BarChart2,
  Sparkles,
  ClipboardList,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useState } from "react";
import { NAVIGATION_ITEMS } from "@/constants/navigation";
import { ROLE_LABELS } from "@/constants";
import type { UserRole } from "@/types";
import { cn } from "@/utils/cn";
import { signOut } from "@/services/auth";
import { useRouter } from "next/navigation";

// Icon map — maps string names from nav config to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Smartphone,
  Package,
  ShoppingCart,
  ArrowLeftRight,
  Bell,
  TrendingUp,
  BarChart2,
  Sparkles,
  ClipboardList,
  MessageSquare,
  Users,
  Settings,
};

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  userEmail: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  userRole,
  userName,
  userEmail,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const filteredNav = NAVIGATION_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  async function handleSignOut() {
    setLoggingOut(true);
    await signOut();
    router.push("/login");
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* ── Logo area ──────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center border-b border-surface-100 px-4",
          collapsed ? "h-16 justify-center" : "h-16 justify-between"
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/images/logoSTC.png"
              alt="Channels by stc"
              width={120}
              height={30}
              className="object-contain"
              priority
            />
          </Link>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600 lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Nav items ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {filteredNav.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-brand-50 text-brand-700 shadow-sm"
                      : "text-surface-600 hover:bg-surface-50 hover:text-surface-900",
                    collapsed && "justify-center px-2"
                  )}
                >
                  {Icon && (
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        isActive
                          ? "text-brand-600"
                          : "text-surface-400 group-hover:text-surface-600"
                      )}
                    />
                  )}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {/* Active indicator bar */}
                  {isActive && !collapsed && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User card ──────────────────────────────────────────── */}
      <div className="border-t border-surface-100 p-3">
        {!collapsed ? (
          <div className="rounded-xl bg-surface-50 p-3">
            <div className="mb-3 flex items-center gap-3">
              {/* Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-surface-900">
                  {userName}
                </p>
                <p className="truncate text-xs text-surface-500">
                  {ROLE_LABELS[userRole]}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={loggingOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignOut}
            disabled={loggingOut}
            title="Sign out"
            className="flex w-full items-center justify-center rounded-xl p-2.5 text-surface-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col",
          "border-r border-surface-100 bg-white",
          "transition-all duration-300 ease-in-out",
          collapsed ? "lg:w-[68px]" : "lg:w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile overlay ─────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-surface-100 bg-white",
          "flex flex-col lg:hidden",
          "transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
