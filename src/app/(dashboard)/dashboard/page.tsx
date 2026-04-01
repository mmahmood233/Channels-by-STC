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

  // ── Parallel data fetching ──────────────────────────────────────────────
  const [
    { count: totalDevices },
    { count: lowStockCount },
    { count: activeAlerts },
    { count: pendingTransfers },
    { data: recentSales },
    { data: recentAlerts },
    { data: recentTransfers },
    { data: salesThisMonth },
  ] = await Promise.all([
    // Active device SKUs
    supabase
      .from("devices")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),

    // Low / out of stock via view
    (() => {
      let q = supabase
        .from("current_inventory_view")
        .select("inventory_id", { count: "exact", head: true })
        .in("stock_status", ["low_stock", "out_of_stock"]);
      if (!isAdmin && !isWarehouse && storeId) q = q.eq("store_id", storeId);
      return q;
    })(),

    // Active alerts
    (() => {
      let q = supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      if (!isAdmin && !isWarehouse && storeId) q = q.eq("store_id", storeId);
      return q;
    })(),

    // Pending transfers
    (() => {
      let q = supabase
        .from("transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!isAdmin && storeId)
        q = q.or(
          `source_store_id.eq.${storeId},destination_store_id.eq.${storeId}`
        );
      return q;
    })(),

    // Recent 5 sales
    (() => {
      let q = supabase
        .from("sales")
        .select("id, sale_date, total_amount, stores(name)")
        .order("sale_date", { ascending: false })
        .limit(5);
      if (!isAdmin && !isWarehouse && storeId) q = q.eq("store_id", storeId);
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
      if (!isAdmin && !isWarehouse && storeId) q = q.eq("store_id", storeId);
      return q;
    })(),

    // Recent 5 transfers
    (() => {
      let q = supabase
        .from("transfers")
        .select(
          "id, status, created_at, from_store:source_store_id(name), to_store:destination_store_id(name)"
        )
        .order("created_at", { ascending: false })
        .limit(5);
      if (!isAdmin && storeId)
        q = q.or(
          `source_store_id.eq.${storeId},destination_store_id.eq.${storeId}`
        );
      return q;
    })(),

    // Revenue this calendar month
    (() => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      let q = supabase
        .from("sales")
        .select("total_amount")
        .gte("sale_date", startOfMonth);
      if (!isAdmin && !isWarehouse && storeId) q = q.eq("store_id", storeId);
      return q;
    })(),
  ]);

  const monthlyRevenue =
    salesThisMonth?.reduce((sum, s) => sum + Number(s.total_amount), 0) ?? 0;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (profile.full_name ?? "").split(" ")[0];

  return (
    <div className="space-y-8">
      {/* ── Greeting ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-surface-900">
          {greeting}, {firstName} 👋
        </h2>
        <p className="mt-1 text-sm text-surface-500">
          Here&apos;s what&apos;s happening across your{" "}
          {isAdmin ? "network" : "store"} today.
        </p>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
          title="Low / Out of Stock"
          value={lowStockCount ?? 0}
          subtitle="Need restocking"
          icon={Package}
          iconColor={(lowStockCount ?? 0) > 0 ? "text-amber-600" : "text-green-600"}
          iconBg={(lowStockCount ?? 0) > 0 ? "bg-amber-50" : "bg-green-50"}
        />
        <StatCard
          title="Active Alerts"
          value={activeAlerts ?? 0}
          subtitle="Require attention"
          icon={Bell}
          iconColor={(activeAlerts ?? 0) > 0 ? "text-red-600" : "text-green-600"}
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

      {/* ── Activity panels ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Sales */}
        <Panel
          title="Recent Sales"
          icon={<ShoppingCart className="h-4 w-4 text-surface-400" />}
          href="/sales"
        >
          {recentSales && recentSales.length > 0 ? (
            recentSales.map((sale) => (
              <PanelRow key={sale.id}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-surface-900">
                    {formatCurrency(Number(sale.total_amount))}
                  </p>
                  <p className="truncate text-xs text-surface-400">
                    {formatDate(sale.sale_date)}
                    {isAdmin && sale.stores
                      ? ` · ${(sale.stores as unknown as { name: string }).name}`
                      : ""}
                  </p>
                </div>
              </PanelRow>
            ))
          ) : (
            <EmptyRow message="No sales yet" />
          )}
        </Panel>

        {/* Active Alerts */}
        <Panel
          title="Active Alerts"
          icon={<Bell className="h-4 w-4 text-surface-400" />}
          href="/alerts"
        >
          {recentAlerts && recentAlerts.length > 0 ? (
            recentAlerts.map((alert) => {
              const sev =
                ALERT_SEVERITY_CONFIG[
                  alert.severity as keyof typeof ALERT_SEVERITY_CONFIG
                ];
              const variant =
                alert.severity === "critical" || alert.severity === "high"
                  ? "danger"
                  : alert.severity === "medium"
                  ? "warning"
                  : "info";
              return (
                <PanelRow key={alert.id}>
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50">
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
                  <Badge variant={variant as "danger" | "warning" | "info"}>
                    {sev?.label ?? alert.severity}
                  </Badge>
                </PanelRow>
              );
            })
          ) : (
            <EmptyRow message="No active alerts" icon="check" />
          )}
        </Panel>

        {/* Recent Transfers */}
        <Panel
          title="Transfers"
          icon={<ArrowLeftRight className="h-4 w-4 text-surface-400" />}
          href="/transfers"
        >
          {recentTransfers && recentTransfers.length > 0 ? (
            recentTransfers.map((t) => {
              const cfg =
                TRANSFER_STATUS_CONFIG[
                  t.status as keyof typeof TRANSFER_STATUS_CONFIG
                ];
              const variant =
                t.status === "completed"
                  ? "success"
                  : t.status === "cancelled"
                  ? "danger"
                  : t.status === "pending"
                  ? "warning"
                  : "info";
              const from = (t.from_store as unknown as { name: string } | null)?.name;
              const to = (t.to_store as unknown as { name: string } | null)?.name;
              return (
                <PanelRow key={t.id}>
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50">
                    <Clock className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-surface-900">
                      <span className="font-medium">{from ?? "?"}</span>
                      <span className="mx-1 text-surface-400">→</span>
                      <span className="font-medium">{to ?? "?"}</span>
                    </p>
                    <p className="text-xs text-surface-400">
                      {formatDate(t.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      variant as "success" | "danger" | "warning" | "info"
                    }
                  >
                    {cfg?.label ?? t.status}
                  </Badge>
                </PanelRow>
              );
            })
          ) : (
            <EmptyRow message="No transfers" />
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────

function Panel({
  title,
  icon,
  href,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-surface-900">{title}</h3>
        </div>
        <a
          href={href}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View all →
        </a>
      </div>
      <div className="divide-y divide-surface-50">{children}</div>
    </div>
  );
}

function PanelRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-6 py-3">{children}</div>
  );
}

function EmptyRow({ message, icon }: { message: string; icon?: "check" }) {
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
