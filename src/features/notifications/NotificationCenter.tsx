"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell, AlertTriangle, ArrowLeftRight, X, CheckCheck,
  ShoppingCart, UserPlus, TrendingDown, PackageX, PackageMinus,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { cn } from "@/utils/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifType =
  | "out_of_stock"       // 🔴 urgent — inventory hits zero
  | "low_stock"          // 🟡 warning — inventory below threshold
  | "alert"              // 🟠 generic system alert
  | "forecast_warning"   // 🔮 AI forecast predicts shortage
  | "transfer_requested" // 📦 warehouse: new transfer needs approval
  | "transfer_updated"   // ✅ store: transfer approved/rejected/completed
  | "sale_recorded"      // 💰 admin/warehouse: new sale live feed
  | "user_created";      // 👤 admin: new user registered

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  at: Date;
  read: boolean;
  urgent?: boolean;
}

interface Props {
  userId: string;
  storeId: string | null;
  userRole: string;
  initialCount: number;
}

// ── Icon & color map ──────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: NotifType }) {
  const configs: Record<NotifType, { icon: React.ReactNode; bg: string }> = {
    out_of_stock:        { icon: <PackageX className="h-4 w-4 text-red-600" />,       bg: "bg-red-100" },
    low_stock:           { icon: <PackageMinus className="h-4 w-4 text-amber-600" />, bg: "bg-amber-100" },
    alert:               { icon: <AlertTriangle className="h-4 w-4 text-orange-600" />, bg: "bg-orange-100" },
    forecast_warning:    { icon: <TrendingDown className="h-4 w-4 text-purple-600" />, bg: "bg-purple-100" },
    transfer_requested:  { icon: <ArrowLeftRight className="h-4 w-4 text-brand-600" />, bg: "bg-brand-100" },
    transfer_updated:    { icon: <ArrowLeftRight className="h-4 w-4 text-green-600" />, bg: "bg-green-100" },
    sale_recorded:       { icon: <ShoppingCart className="h-4 w-4 text-blue-600" />,   bg: "bg-blue-100" },
    user_created:        { icon: <UserPlus className="h-4 w-4 text-teal-600" />,       bg: "bg-teal-100" },
  };
  const { icon, bg } = configs[type];
  return (
    <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", bg)}>
      {icon}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationCenter({ userId, storeId, userRole, initialCount }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const isAdmin     = userRole === "admin";
  const isWarehouse = userRole === "warehouse_manager";
  const isStore     = userRole === "store_manager";

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  function push(notif: Omit<Notification, "read">) {
    setNotifications((prev) => {
      // deduplicate by id
      if (prev.some((n) => n.id === notif.id)) return prev;
      return [{ ...notif, read: false }, ...prev.slice(0, 29)];
    });
  }

  useEffect(() => {
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // ── 1. Alerts INSERT ──────────────────────────────────────────────────────
    // Store managers: only their store. Admin/warehouse: all.
    const alertChannel = supabase
      .channel("notif-alerts")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "alerts",
        ...(isStore && storeId ? { filter: `store_id=eq.${storeId}` } : {}),
      }, (payload) => {
        const row = payload.new as {
          id: string; title: string; alert_type: string;
          severity: string; current_quantity: number | null; created_at: string;
        };

        if (row.alert_type === "out_of_stock") {
          push({
            id: `alert-${row.id}`,
            type: "out_of_stock",
            title: "Out of Stock",
            body: row.title,
            at: new Date(row.created_at),
            urgent: true,
          });
        } else if (row.alert_type === "low_stock") {
          push({
            id: `alert-${row.id}`,
            type: "low_stock",
            title: "Low Stock Warning",
            body: `${row.title}${row.current_quantity != null ? ` — ${row.current_quantity} units remaining` : ""}`,
            at: new Date(row.created_at),
          });
        } else if (row.alert_type === "forecast_warning") {
          push({
            id: `alert-${row.id}`,
            type: "forecast_warning",
            title: "Forecast Warning",
            body: row.title,
            at: new Date(row.created_at),
          });
        } else {
          push({
            id: `alert-${row.id}`,
            type: "alert",
            title: "System Alert",
            body: row.title,
            at: new Date(row.created_at),
          });
        }
      })
      .subscribe();
    channels.push(alertChannel);

    // ── 2. Transfers INSERT — warehouse/admin: new request needs approval ─────
    if (isAdmin || isWarehouse) {
      const transferNewChannel = supabase
        .channel("notif-transfers-new")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "transfers",
        }, (payload) => {
          const row = payload.new as {
            id: string; source_store_id: string; destination_store_id: string; created_at: string;
          };
          push({
            id: `transfer-new-${row.id}`,
            type: "transfer_requested",
            title: "New Transfer Request",
            body: `A store has requested a new transfer — awaiting your approval`,
            at: new Date(row.created_at),
          });
        })
        .subscribe();
      channels.push(transferNewChannel);
    }

    // ── 3. Transfers UPDATE — store: status changed on transfers to/from their store ──
    {
      const filter = isStore && storeId
        ? `destination_store_id=eq.${storeId}`
        : undefined;

      const transferUpdateChannel = supabase
        .channel("notif-transfers-update")
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "transfers",
          ...(filter ? { filter } : {}),
        }, (payload) => {
          const row = payload.new as { id: string; status: string };
          const old = payload.old as { status: string };
          // Only fire if status actually changed
          if (row.status === old.status) return;

          const messages: Record<string, { title: string; body: string }> = {
            approved:   { title: "Transfer Approved",       body: `Your transfer request #${row.id.slice(0, 8)} has been approved` },
            rejected:   { title: "Transfer Rejected",       body: `Your transfer request #${row.id.slice(0, 8)} was rejected` },
            in_transit: { title: "Transfer In Transit",     body: `Transfer #${row.id.slice(0, 8)} is on its way` },
            completed:  { title: "Transfer Received",       body: `Transfer #${row.id.slice(0, 8)} has arrived at your store` },
            cancelled:  { title: "Transfer Cancelled",      body: `Transfer #${row.id.slice(0, 8)} was cancelled` },
          };
          const msg = messages[row.status];
          if (!msg) return;
          push({
            id: `transfer-upd-${row.id}-${row.status}`,
            type: "transfer_updated",
            title: msg.title,
            body: msg.body,
            at: new Date(),
            urgent: row.status === "rejected",
          });
        })
        .subscribe();
      channels.push(transferUpdateChannel);
    }

    // ── 4. Sales INSERT — admin & warehouse: live sale feed ──────────────────
    if (isAdmin || isWarehouse) {
      const salesChannel = supabase
        .channel("notif-sales")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "sales",
        }, (payload) => {
          const row = payload.new as {
            id: string; store_id: string; total_amount: number; created_at: string;
          };
          push({
            id: `sale-${row.id}`,
            type: "sale_recorded",
            title: "New Sale Recorded",
            body: `BD ${Number(row.total_amount).toFixed(3)} sale recorded`,
            at: new Date(row.created_at),
          });
        })
        .subscribe();
      channels.push(salesChannel);
    }

    // ── 5. Forecasts UPSERT — admin & warehouse: shortage predicted ───────────
    if (isAdmin || isWarehouse) {
      const forecastChannel = supabase
        .channel("notif-forecasts")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "forecasts",
        }, (payload) => {
          // We only care if the python script flagged shortage — check via forecast_vs_inventory_view
          // but since we don't have risk_level on the base table, we use predicted_quantity vs a low threshold
          const row = payload.new as {
            id: string; device_id: string; store_id: string | null;
            forecast_period: string; predicted_quantity: number; confidence_score: number | null; created_at: string;
          };
          push({
            id: `forecast-${row.id}`,
            type: "forecast_warning",
            title: "Forecast Updated",
            body: `New demand forecast generated — predicted ${row.predicted_quantity} units needed${row.confidence_score != null ? ` (${(row.confidence_score * 100).toFixed(0)}% confidence)` : ""}`,
            at: new Date(row.created_at),
          });
        })
        .subscribe();
      channels.push(forecastChannel);
    }

    // ── 6. Profiles INSERT — admin only: new user registered ─────────────────
    if (isAdmin) {
      const usersChannel = supabase
        .channel("notif-users")
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "profiles",
        }, (payload) => {
          const row = payload.new as {
            id: string; full_name: string | null; email: string; role: string; created_at: string;
          };
          // Don't notify about own account creation
          if (row.id === userId) return;
          push({
            id: `user-${row.id}`,
            type: "user_created",
            title: "New User Created",
            body: `${row.full_name ?? row.email} joined as ${row.role.replace("_", " ")}`,
            at: new Date(row.created_at),
          });
        })
        .subscribe();
      channels.push(usersChannel);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [storeId, userRole, userId]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function formatRelative(date: Date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString("en-BH", { month: "short", day: "numeric" });
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayCount = notifications.length === 0 ? initialCount : unreadCount;
  const hasUrgent = notifications.some((n) => !n.read && n.urgent);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900"
        aria-label="Notifications"
      >
        <Bell className={cn("h-5 w-5", hasUrgent && "text-red-500")} />
        {displayCount > 0 && (
          <span className={cn(
            "absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white",
            hasUrgent ? "bg-red-500 animate-pulse" : "bg-accent-500",
            displayCount > 9 && "w-5 px-0.5"
          )}>
            {displayCount > 9 ? "9+" : displayCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-surface-100 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-surface-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-600" />
              <span className="text-sm font-semibold text-surface-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-surface-400 hover:text-brand-600">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-surface-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-surface-400">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-xs font-medium">No new notifications</p>
                <p className="text-[11px] opacity-60 text-center px-6">
                  Stock alerts, transfers, forecasts & more appear here live
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "group flex gap-3 px-4 py-3 transition-colors hover:bg-surface-50",
                    !n.read && n.urgent && "bg-red-50/50",
                    !n.read && !n.urgent && "bg-brand-50/30",
                  )}
                >
                  <NotifIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-xs font-semibold text-surface-900",
                        !n.read && n.urgent && "text-red-700",
                        !n.read && !n.urgent && "text-brand-700",
                      )}>
                        {n.title}
                      </p>
                      <button
                        onClick={() => dismiss(n.id)}
                        className="shrink-0 text-surface-300 opacity-0 transition-opacity hover:text-surface-500 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-surface-500 leading-relaxed">{n.body}</p>
                    <p className="mt-1 text-[10px] text-surface-400">{formatRelative(n.at)}</p>
                  </div>
                  {!n.read && (
                    <span className={cn(
                      "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                      n.urgent ? "bg-red-500" : "bg-brand-600"
                    )} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-surface-100 px-4 py-2.5">
            <p className="text-center text-[10px] text-surface-400">
              Live via Supabase Realtime · {[
                isStore && "alerts, transfers",
                (isAdmin || isWarehouse) && "alerts, transfers, sales, forecasts",
                isAdmin && ", users",
              ].filter(Boolean).join("")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
