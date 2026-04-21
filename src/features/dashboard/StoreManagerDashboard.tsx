import {
  ShoppingCart, Package, Bell, ArrowLeftRight,
  DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, BarChart3,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewSaleModal } from "@/features/sales/NewSaleModal";
import { NewTransferModal } from "@/features/transfers/NewTransferModal";
import { formatCurrency, formatDate } from "@/utils/format";
import { TRANSFER_STATUS_CONFIG, ALERT_SEVERITY_CONFIG } from "@/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/utils/cn";

interface Props {
  userId: string;
  storeId: string;
  storeName: string;
  userName: string;
}

export async function StoreManagerDashboard({ userId, storeId, storeName, userName }: Props) {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const todayISO     = now.toISOString().split("T")[0];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const startOfWeek  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const endLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  const [
    { data: todaySales },
    { data: monthlySales },
    { data: lastMonthSales },
    { count: lowStockCount },
    { count: activeAlerts },
    { count: pendingTransfers },
    { data: recentSales },
    { data: stockAlerts },
    { data: myTransfers },
    { data: topDevices },
    { data: inventoryForModal },
    { data: allStores },
    { data: devicesForSale },
  ] = await Promise.all([
    // Today's sales
    supabase.from("sales").select("total_amount").eq("store_id", storeId).eq("sale_date", todayISO),
    // This month's sales
    supabase.from("sales").select("total_amount").eq("store_id", storeId).gte("sale_date", startOfMonth),
    supabase.from("sales").select("total_amount").eq("store_id", storeId).gte("sale_date", startLastMonth).lte("sale_date", endLastMonth),
    // Low stock
    supabase.from("current_inventory_view").select("inventory_id", { count: "exact", head: true })
      .eq("store_id", storeId).in("stock_status", ["low_stock", "out_of_stock"]),
    // Active alerts
    supabase.from("alerts").select("id", { count: "exact", head: true })
      .eq("store_id", storeId).eq("status", "active"),
    // Pending transfers
    supabase.from("transfers").select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or(`source_store_id.eq.${storeId},destination_store_id.eq.${storeId}`),
    // Recent 6 sales
    supabase.from("sales")
      .select("id, sale_date, total_amount, sale_items(quantity, devices(name))")
      .eq("store_id", storeId)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    // Active stock alerts
    supabase.from("alerts")
      .select("id, title, severity, alert_type, current_quantity, threshold, devices(name, sku)")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
    // My recent transfers
    supabase.from("transfers")
      .select("id, status, created_at, from_store:source_store_id(name), to_store:destination_store_id(name), transfer_items(quantity, devices(name))")
      .or(`source_store_id.eq.${storeId},destination_store_id.eq.${storeId}`)
      .order("created_at", { ascending: false })
      .limit(5),
    // Top selling devices this month
    supabase.from("monthly_sales_view")
      .select("device_name, brand, total_units_sold, total_revenue")
      .eq("store_id", storeId)
      .gte("sale_month", startOfMonth)
      .order("total_units_sold", { ascending: false })
      .limit(5),
    // Inventory for transfer modal
    supabase.from("current_inventory_view")
      .select("device_id, device_name, brand, sku, quantity")
      .eq("store_id", storeId)
      .gt("quantity", 0)
      .order("device_name"),
    // All stores for transfer modal
    supabase.from("stores").select("id, name, is_warehouse").eq("status", "active").order("name"),
    // Active devices for sale modal
    supabase.from("devices").select("id, name, brand, sku, unit_price").eq("status", "active").order("brand").order("name"),
  ]);

  const todayRevenue     = todaySales?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0;
  const monthRevenue     = monthlySales?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0;
  const lastMonthRevenue = lastMonthSales?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0;
  const revTrend = lastMonthRevenue > 0
    ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null;

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const firstName = userName.split(" ")[0];

  // Shape inventory for modal
  const modalInventory = (inventoryForModal ?? []).map((r) => ({
    id: r.device_id as string,
    name: r.device_name as string,
    brand: r.brand as string,
    sku: r.sku as string,
    quantity: r.quantity as number,
  }));

  const modalDevices = (devicesForSale ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    brand: d.brand as string,
    sku: d.sku as string,
    unit_price: Number(d.unit_price),
  }));

  const modalStores = (allStores ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    is_warehouse: s.is_warehouse as boolean,
  }));

  return (
    <div className="space-y-8">
      {/* Header + Quick Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">
            {greeting}, {firstName} 👋
          </h2>
          <p className="mt-1 text-sm text-surface-500">
            {storeName} · {formatDate(todayISO)}
          </p>
        </div>
        <div className="flex gap-3">
          <NewSaleModal storeId={storeId} devices={modalDevices} />
          <NewTransferModal
            currentStoreId={storeId}
            allStores={modalStores}
            inventoryAtCurrentStore={modalInventory}
            userRole="store_manager"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(todayRevenue)}
          subtitle={`${todaySales?.length ?? 0} sale${(todaySales?.length ?? 0) !== 1 ? "s" : ""} today`}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(monthRevenue)}
          subtitle={`${monthlySales?.length ?? 0} sales this month`}
          icon={TrendingUp}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
          trend={revTrend !== null ? { value: revTrend, label: "vs last month" } : undefined}
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
          subtitle={`${pendingTransfers ?? 0} pending transfers`}
          icon={Bell}
          iconColor={(activeAlerts ?? 0) > 0 ? "text-red-600" : "text-green-600"}
          iconBg={(activeAlerts ?? 0) > 0 ? "bg-red-50" : "bg-green-50"}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Sales */}
        <div className="lg:col-span-2 rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">Recent Sales</h3>
            </div>
            <a href="/sales" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</a>
          </div>
          {recentSales && recentSales.length > 0 ? (
            <div className="divide-y divide-surface-50">
              {recentSales.map((sale) => {
                const items = (sale.sale_items as unknown as { quantity: number; devices: { name: string } | null }[]) ?? [];
                const unitCount = items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <div key={sale.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-surface-600">
                        {items.slice(0, 2).map((i) => `${i.quantity}× ${i.devices?.name ?? "?"}`).join(", ")}
                        {items.length > 2 && ` +${items.length - 2} more`}
                      </p>
                      <p className="text-xs text-surface-400">{formatDate(sale.sale_date)} · {unitCount} unit{unitCount !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-bold text-surface-900">{formatCurrency(Number(sale.total_amount))}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={ShoppingCart} title="No sales yet" description='Use "Record Sale" to log a transaction' />
          )}
        </div>

        {/* Stock Alerts */}
        <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">Stock Alerts</h3>
            </div>
            <a href="/alerts" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</a>
          </div>
          {stockAlerts && stockAlerts.length > 0 ? (
            <div className="divide-y divide-surface-50">
              {stockAlerts.map((alert) => {
                const sev = ALERT_SEVERITY_CONFIG[alert.severity as keyof typeof ALERT_SEVERITY_CONFIG];
                const variant = alert.severity === "critical" || alert.severity === "high" ? "danger"
                  : alert.severity === "medium" ? "warning" : "info";
                const dev = alert.devices as unknown as { name: string; sku: string } | null;
                return (
                  <div key={alert.id} className="flex items-start gap-3 px-6 py-3">
                    <AlertTriangle className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      alert.severity === "critical" ? "text-red-500" : alert.severity === "high" ? "text-orange-500" : "text-amber-500"
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900">{dev?.name ?? alert.title}</p>
                      <p className="text-xs text-surface-400">
                        {alert.current_quantity !== null ? `${alert.current_quantity} remaining` : ""}
                        {alert.threshold !== null ? ` (threshold: ${alert.threshold})` : ""}
                      </p>
                    </div>
                    <Badge variant={variant as "danger" | "warning" | "info"}>
                      {sev?.label ?? alert.severity}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="No active alerts" />
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top selling this month */}
        <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">Top Selling This Month</h3>
            </div>
          </div>
          {topDevices && topDevices.length > 0 ? (
            <div className="divide-y divide-surface-50">
              {topDevices.map((d, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-bold text-surface-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900">
                      {(d as unknown as { brand: string }).brand} {(d as unknown as { device_name: string }).device_name}
                    </p>
                    <p className="text-xs text-surface-400">{(d as unknown as { total_units_sold: number }).total_units_sold} units sold</p>
                  </div>
                  <span className="text-sm font-semibold text-green-700">
                    {formatCurrency(Number((d as unknown as { total_revenue: number }).total_revenue))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="No sales data yet" />
          )}
        </div>

        {/* Recent Transfers */}
        <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">My Transfers</h3>
            </div>
            <a href="/transfers" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</a>
          </div>
          {myTransfers && myTransfers.length > 0 ? (
            <div className="divide-y divide-surface-50">
              {myTransfers.map((t) => {
                const cfg = TRANSFER_STATUS_CONFIG[t.status as keyof typeof TRANSFER_STATUS_CONFIG];
                const variant = t.status === "completed" ? "success" : t.status === "cancelled" ? "danger"
                  : t.status === "pending" ? "warning" : "info";
                const from = (t.from_store as unknown as { name: string } | null)?.name;
                const to = (t.to_store as unknown as { name: string } | null)?.name;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-6 py-3">
                    <Clock className="h-4 w-4 shrink-0 text-surface-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-surface-900">
                        <span className="font-medium">{from ?? "?"}</span>
                        <span className="mx-1 text-surface-400">→</span>
                        <span className="font-medium">{to ?? "?"}</span>
                      </p>
                      <p className="text-xs text-surface-400">{formatDate(t.created_at)}</p>
                    </div>
                    <Badge variant={variant as "success" | "danger" | "warning" | "info"}>
                      {cfg?.label ?? t.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={ArrowLeftRight} title="No transfers yet" description='Use "Request Transfer" to move stock' />
          )}
        </div>
      </div>
    </div>
  );
}
