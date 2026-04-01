import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import {
  Smartphone,
  Package,
  ShoppingCart,
  ArrowLeftRight,
  Bell,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/utils/format";
import { TRANSFER_STATUS_CONFIG, ALERT_SEVERITY_CONFIG } from "@/constants";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id, full_name")
    .eq("id", session.user.id)
    .single();

  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";
  const isWarehouse = profile.role === "warehouse_manager";
  const storeId = profile.store_id;

  // ── Parallel data fetching ──────────────────────────────────────────────────

  const [
    { count: totalDevices },
    { count: totalInventoryLines },
    { count: lowStockCount },
    { count: activeAlerts },
    { count: pendingTransfers },
    { data: recentSales },
    { data: recentAlerts },
    { data: recentTransfers },
    { data: salesThisMonth },
  ] = await Promise.all([
    // Total device SKUs
    supabase
      .from("devices")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    // Inventory lines (relevant to role)
    (() => {
      let q = supabase
        .from("inventory")
        .select("id", { count: "exact", head: true });
      if (!isAdmin && !isWarehouse && storeId) {
        q = q.eq("store_id", storeId);
      }
      return q;
    })(),

    // Low / out of stock
    (() => {
      let q = supabase
        .from("inventory")
        .select("id", { count: "exact", head: true })
        .in("stock_status", ["low_stock", "out_of_stock"]);
      if (!isAdmin && !isWarehouse && storeId) {
        q = q.eq("store_id", storeId);
      }
      return q;
    })(),

    // Active alerts
    (() => {
      let q = supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      if (!isAdmin && !isWarehouse && storeId) {
        q = q.eq("store_id", storeId);
      }
      return q;
    })(),

    // Pending transfers
    (() => {
      let q = supabase
        .from("transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!isAdmin && storeId) {
        q = q.or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`);
      }
      return q;
    })(),

    // Recent 5 sales
    (() => {
      let q = supabase
        .from("sales")
        .select(
          "id, sale_date, total_amount, payment_method, stores(name), profiles(full_name)"
        )
        .order("sale_date", { ascending: false })
        .limit(5);
      if (!isAdmin && !isWarehouse && storeId) {
        q = q.eq("store_id", storeId);
      }
      return q;
    })(),

    // Recent 5 active alerts
    (() => {
      let q = supabase
        .from("alerts")
        .select("id, title, severity, created_at, stores(name)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);
      if (!isAdmin && !isWarehouse && storeId) {
        q = q.eq("store_id", storeId);
      }
      return q;
    })(),

    // Recent 5 transfers
    (() => {
      let q = supabase
        .from("transfers")
        .select(
          "id, status, created_at, from_store:from_store_id(name), to_store:to_store_id(name)"
        )
        .order("created_at", { ascending: false })
        .limit(5);
      if (!isAdmin && storeId) {
        q = q.or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`);
      }
      return q;
    })(),

    // Sales this calendar month — for revenue stat
    (() => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      let q = supabase
        .from("sales")
        .select("total_amount")
        .gte("sale_date", startOfMonth);
      if (!isAdmin && !isWarehouse && storeId) {
        q = q.eq("store_id", storeId);
      }
      return q;
    })(),
  ]);

  const monthlyRevenue =
    salesThisMonth?.reduce((sum, s) => sum + Number(s.total_amount), 0) ?? 0;

  // ── Greeting ───────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (profile.full_name ?? "").split(" ")[0];

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-surface-900">
          {greeting}, {firstName} 👋
        </h2>
        <p className="mt-1 text-sm text-surface-500">
          Here&apos;s what&apos;s happening across your{" "}
          {isAdmin ? "network" : "store"} today.
        </p>
      </div>

      {/* ── KPI stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          title="Device SKUs"
          value={totalDevices ?? 0}
          subtitle="Active product catalogue"
          icon={Smartphone}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(monthlyRevenue)}
          subtitle="This calendar month"
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Inventory Lines"
          value={totalInventoryLines ?? 0}
          subtitle="Across all locations"
          icon={Package}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Low / Out of Stock"
          value={lowStockCount ?? 0}
          subtitle="Need restocking"
          icon={AlertTriangle}
          iconColor={
            (lowStockCount ?? 0) > 0 ? "text-amber-600" : "text-green-600"
          }
          iconBg={
            (lowStockCount ?? 0) > 0 ? "bg-amber-50" : "bg-green-50"
          }
        />
        <StatCard
          title="Active Alerts"
          value={activeAlerts ?? 0}
          subtitle="Require attention"
          icon={Bell}
          iconColor={
            (activeAlerts ?? 0) > 0 ? "text-red-600" : "text-green-600"
          }
          iconBg={(activeAlerts ?? 0) > 0 ? "bg-red-50" : "bg-green-50"}
        />
        <StatCard
          title="Pending Transfers"
          value={pendingTransfers ?? 0}
          subtitle="Awaiting approval"
          icon={ArrowLeftRight}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* ── Bottom panels ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Sales */}
        <div className="lg:col-span-1 rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">Recent Sales</h3>
            </div>
            <a
              href="/sales"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all →
            </a>
          </div>

          <div className="divide-y divide-surface-50">
            {recentSales && recentSales.length > 0 ? (
              recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900">
                      {formatCurrency(Number(sale.total_amount))}
                    </p>
                    <p className="truncate text-xs text-surface-400">
                      {formatDate(sale.sale_date)}{" "}
                      {isAdmin &&
                        Array.isArray(sale.stores) &&
                        sale.stores.length > 0
                        ? `· ${(sale.stores as { name: string }[])[0].name}`
                        : !Array.isArray(sale.stores) && sale.stores
                        ? `· ${(sale.stores as { name: string }).name}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs capitalize text-surface-400">
                    {sale.payment_method?.replace("_", " ")}
                  </span>
                </div>
              ))
            ) : (
              <EmptyRow message="No sales yet" />
            )}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="lg:col-span-1 rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">Active Alerts</h3>
            </div>
            <a
              href="/alerts"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all →
            </a>
          </div>

          <div className="divide-y divide-surface-50">
            {recentAlerts && recentAlerts.length > 0 ? (
              recentAlerts.map((alert) => {
                const sev =
                  ALERT_SEVERITY_CONFIG[
                    alert.severity as keyof typeof ALERT_SEVERITY_CONFIG
                  ];
                const badgeVariant =
                  alert.severity === "critical"
                    ? "danger"
                    : alert.severity === "high"
                    ? "danger"
                    : alert.severity === "medium"
                    ? "warning"
                    : "info";
                return (
                  <div key={alert.id} className="flex items-start gap-3 px-6 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900">
                        {alert.title}
                      </p>
                      <p className="text-xs text-surface-400">
                        {formatDate(alert.created_at)}
                      </p>
                    </div>
                    <Badge variant={badgeVariant as "danger" | "warning" | "info"}>
                      {sev?.label ?? alert.severity}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <EmptyRow message="No active alerts" icon="check" />
            )}
          </div>
        </div>

        {/* Recent Transfers */}
        <div className="lg:col-span-1 rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">Transfers</h3>
            </div>
            <a
              href="/transfers"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all →
            </a>
          </div>

          <div className="divide-y divide-surface-50">
            {recentTransfers && recentTransfers.length > 0 ? (
              recentTransfers.map((transfer) => {
                const statusCfg =
                  TRANSFER_STATUS_CONFIG[
                    transfer.status as keyof typeof TRANSFER_STATUS_CONFIG
                  ];
                const badgeVariant =
                  transfer.status === "completed"
                    ? "success"
                    : transfer.status === "cancelled"
                    ? "danger"
                    : transfer.status === "pending"
                    ? "warning"
                    : "info";

                const fromStore = Array.isArray(transfer.from_store)
                  ? (transfer.from_store as { name: string }[])[0]?.name
                  : (transfer.from_store as { name: string } | null)?.name;
                const toStore = Array.isArray(transfer.to_store)
                  ? (transfer.to_store as { name: string }[])[0]?.name
                  : (transfer.to_store as { name: string } | null)?.name;

                return (
                  <div key={transfer.id} className="flex items-start gap-3 px-6 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 mt-0.5">
                      <Clock className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-surface-900">
                        <span className="font-medium">{fromStore ?? "?"}</span>
                        <span className="mx-1 text-surface-400">→</span>
                        <span className="font-medium">{toStore ?? "?"}</span>
                      </p>
                      <p className="text-xs text-surface-400">
                        {formatDate(transfer.created_at)}
                      </p>
                    </div>
                    <Badge variant={badgeVariant as "success" | "danger" | "warning" | "info"}>
                      {statusCfg?.label ?? transfer.status}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <EmptyRow message="No transfers" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────
function EmptyRow({
  message,
  icon,
}: {
  message: string;
  icon?: "check";
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon === "check" ? (
        <CheckCircle2 className="mb-2 h-8 w-8 text-green-400" />
      ) : (
        <TrendingUp className="mb-2 h-8 w-8 text-surface-200" />
      )}
      <p className="text-sm text-surface-400">{message}</p>
    </div>
  );
}
