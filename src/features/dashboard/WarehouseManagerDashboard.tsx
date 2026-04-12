import {
  Package, ArrowLeftRight, Bell, TrendingUp,
  AlertTriangle, Clock, CheckCircle2, Warehouse,
  BarChart3, Activity,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewTransferModal } from "@/features/transfers/NewTransferModal";
import { TransferActions } from "@/features/transfers/TransferActions";
import { formatCurrency, formatDate } from "@/utils/format";
import { TRANSFER_STATUS_CONFIG, ALERT_SEVERITY_CONFIG } from "@/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/utils/cn";

interface Props {
  userId: string;
  userName: string;
}

export async function WarehouseManagerDashboard({ userId, userName }: Props) {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const [
    { data: allStores },
    { count: totalLowStock },
    { count: activeAlerts },
    { count: pendingTransfers },
    { data: storeInventorySnapshot },
    { data: pendingTransfersList },
    { data: recentAlerts },
    { data: topSellingMonth },
    { data: inventoryForModal },
    { data: devicesRef },
  ] = await Promise.all([
    // All active stores
    supabase.from("stores").select("id, name, code, is_warehouse").eq("status", "active").order("is_warehouse", { ascending: false }).order("name"),
    // Low stock across all stores
    supabase.from("current_inventory_view").select("inventory_id", { count: "exact", head: true })
      .in("stock_status", ["low_stock", "out_of_stock"]),
    // Active alerts all stores
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active"),
    // Pending transfers needing action
    supabase.from("transfers").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // Inventory summary per store
    supabase.from("current_inventory_view")
      .select("store_id, store_name, is_warehouse, stock_status")
      .order("store_name"),
    // Pending transfers list (up to 10)
    supabase.from("transfers")
      .select("id, status, created_at, notes, from_store:source_store_id(name), to_store:destination_store_id(name), requester:requested_by(full_name), transfer_items(quantity, devices(name))")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10),
    // Recent active alerts across all stores
    supabase.from("alerts")
      .select("id, title, severity, status, created_at, stores(name), devices(name)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6),
    // Top selling devices this month across all stores
    supabase.from("monthly_sales_view")
      .select("device_name, brand, total_units_sold, total_revenue")
      .gte("sale_month", startOfMonth)
      .order("total_units_sold", { ascending: false })
      .limit(5),
    // Warehouse inventory for modal
    supabase.from("current_inventory_view")
      .select("device_id, device_name, brand, sku, quantity, store_id")
      .gt("quantity", 0)
      .order("device_name"),
    // Device list ref
    supabase.from("devices").select("id, name, brand, sku, unit_price").eq("status", "active").order("brand"),
  ]);

  // Build per-store inventory summary
  const storeMap: Record<string, { name: string; is_warehouse: boolean; total: number; low: number; out: number }> = {};
  for (const row of storeInventorySnapshot ?? []) {
    const sid = row.store_id as string;
    if (!storeMap[sid]) {
      storeMap[sid] = { name: row.store_name as string, is_warehouse: row.is_warehouse as boolean, total: 0, low: 0, out: 0 };
    }
    storeMap[sid].total++;
    if (row.stock_status === "low_stock") storeMap[sid].low++;
    if (row.stock_status === "out_of_stock") storeMap[sid].out++;
  }
  const storeSnapshots = Object.values(storeMap).sort((a, b) => (a.is_warehouse ? -1 : 1));

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const firstName = userName.split(" ")[0];

  const modalInventory = (inventoryForModal ?? []).map((r) => ({
    id: r.device_id as string,
    name: r.device_name as string,
    brand: r.brand as string,
    sku: r.sku as string,
    quantity: r.quantity as number,
  }));

  const modalStores = (allStores ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    is_warehouse: s.is_warehouse as boolean,
  }));

  // Get warehouse id for modal default source
  const warehouseStore = (allStores ?? []).find((s) => s.is_warehouse);
  const warehouseId = warehouseStore?.id ?? (allStores?.[0]?.id ?? "");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">
            {greeting}, {firstName} 👋
          </h2>
          <p className="mt-1 text-sm text-surface-500">
            Warehouse Operations · {formatDate(now.toISOString().split("T")[0])}
          </p>
        </div>
        <NewTransferModal
          currentStoreId={warehouseId}
          allStores={modalStores}
          inventoryAtCurrentStore={modalInventory}
          userRole="warehouse_manager"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Network Stores"
          value={(allStores?.length ?? 0) - 1}
          subtitle={`+ ${allStores?.filter((s) => s.is_warehouse).length ?? 0} warehouse`}
          icon={Warehouse}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          title="Pending Transfers"
          value={pendingTransfers ?? 0}
          subtitle="Awaiting approval"
          icon={ArrowLeftRight}
          iconColor={(pendingTransfers ?? 0) > 0 ? "text-amber-600" : "text-green-600"}
          iconBg={(pendingTransfers ?? 0) > 0 ? "bg-amber-50" : "bg-green-50"}
        />
        <StatCard
          title="Low / Out of Stock"
          value={totalLowStock ?? 0}
          subtitle="Across all stores"
          icon={Package}
          iconColor={(totalLowStock ?? 0) > 0 ? "text-red-600" : "text-green-600"}
          iconBg={(totalLowStock ?? 0) > 0 ? "bg-red-50" : "bg-green-50"}
        />
        <StatCard
          title="Active Alerts"
          value={activeAlerts ?? 0}
          subtitle="System-wide"
          icon={Bell}
          iconColor={(activeAlerts ?? 0) > 0 ? "text-red-600" : "text-green-600"}
          iconBg={(activeAlerts ?? 0) > 0 ? "bg-red-50" : "bg-green-50"}
        />
      </div>

      {/* Store Inventory Overview */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        <div className="flex items-center gap-2 border-b border-surface-100 px-6 py-4">
          <Activity className="h-4 w-4 text-surface-400" />
          <h3 className="font-semibold text-surface-900">Store Inventory Health</h3>
        </div>
        <div className="grid grid-cols-1 divide-y divide-surface-50 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-3">
          {storeSnapshots.map((store, i) => {
            const health = store.out > 0 ? "critical" : store.low > 0 ? "warning" : "healthy";
            return (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                  store.is_warehouse ? "bg-brand-100 text-brand-700"
                    : health === "critical" ? "bg-red-100 text-red-700"
                    : health === "warning" ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                )}>
                  {store.is_warehouse ? "WH" : store.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-surface-900">
                    {store.name}
                    {store.is_warehouse && <span className="ml-1.5 text-xs text-surface-400">(Warehouse)</span>}
                  </p>
                  <div className="mt-1 flex gap-3 text-xs">
                    <span className="text-surface-400">{store.total} SKUs</span>
                    {store.low > 0 && <span className="text-amber-600 font-medium">{store.low} low</span>}
                    {store.out > 0 && <span className="text-red-600 font-medium">{store.out} out</span>}
                    {store.low === 0 && store.out === 0 && <span className="text-green-600">All stocked</span>}
                  </div>
                </div>
                <a href={`/inventory?store=${Object.keys(storeMap).find((k) => storeMap[k].name === store.name)}`}
                  className="text-xs text-brand-600 hover:underline">View →</a>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Approvals + Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Transfer Approvals */}
        <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">Pending Approvals</h3>
              {(pendingTransfers ?? 0) > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {pendingTransfers}
                </span>
              )}
            </div>
            <a href="/transfers" className="text-xs font-medium text-brand-600 hover:text-brand-700">All transfers →</a>
          </div>
          {pendingTransfersList && pendingTransfersList.length > 0 ? (
            <div className="divide-y divide-surface-50">
              {pendingTransfersList.map((t) => {
                const from = (t.from_store as unknown as { name: string } | null)?.name;
                const to = (t.to_store as unknown as { name: string } | null)?.name;
                const requester = (t.requester as unknown as { full_name: string } | null)?.full_name;
                const tItems = (t.transfer_items as unknown as { quantity: number; devices: { name: string } | null }[]) ?? [];
                return (
                  <div key={t.id} className="px-6 py-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-surface-900">
                        <span>{from ?? "?"}</span>
                        <ArrowLeftRight className="h-3.5 w-3.5 text-surface-400" />
                        <span>{to ?? "?"}</span>
                      </div>
                      <span className="text-xs text-surface-400">{formatDate(t.created_at)}</span>
                    </div>
                    <p className="mb-2 text-xs text-surface-500">
                      By {requester ?? "—"} · {tItems.slice(0, 2).map((i) => `${i.quantity}× ${i.devices?.name ?? "?"}`).join(", ")}
                      {tItems.length > 2 && ` +${tItems.length - 2} more`}
                    </p>
                    <TransferActions transferId={t.id} status={t.status} userRole="warehouse_manager" />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="No pending approvals" />
          )}
        </div>

        {/* Active Alerts */}
        <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-surface-400" />
              <h3 className="font-semibold text-surface-900">Active Alerts</h3>
            </div>
            <a href="/alerts" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</a>
          </div>
          {recentAlerts && recentAlerts.length > 0 ? (
            <div className="divide-y divide-surface-50">
              {recentAlerts.map((alert) => {
                const sev = ALERT_SEVERITY_CONFIG[alert.severity as keyof typeof ALERT_SEVERITY_CONFIG];
                const variant = alert.severity === "critical" || alert.severity === "high" ? "danger"
                  : alert.severity === "medium" ? "warning" : "info";
                const store = (alert.stores as unknown as { name: string } | null)?.name;
                return (
                  <div key={alert.id} className="flex items-start gap-3 px-6 py-3">
                    <AlertTriangle className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      alert.severity === "critical" ? "text-red-500" : "text-amber-500"
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900">{alert.title}</p>
                      <p className="text-xs text-surface-400">{store} · {formatDate(alert.created_at)}</p>
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

      {/* Top Selling This Month */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        <div className="flex items-center gap-2 border-b border-surface-100 px-6 py-4">
          <BarChart3 className="h-4 w-4 text-surface-400" />
          <h3 className="font-semibold text-surface-900">Top Selling Devices This Month (Network)</h3>
        </div>
        {topSellingMonth && topSellingMonth.length > 0 ? (
          <div className="grid grid-cols-1 divide-y divide-surface-50 sm:grid-cols-5 sm:divide-y-0">
            {topSellingMonth.map((d, i) => {
              const dev = d as unknown as { brand: string; device_name: string; total_units_sold: number; total_revenue: number };
              return (
                <div key={i} className="flex flex-col items-center gap-1 p-5 text-center">
                  <span className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-100 text-xs font-bold text-surface-500">
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold text-surface-900 leading-tight">{dev.brand} {dev.device_name}</p>
                  <p className="text-lg font-bold text-brand-700">{dev.total_units_sold}</p>
                  <p className="text-xs text-surface-400">units sold</p>
                  <p className="text-xs font-medium text-green-600">{formatCurrency(Number(dev.total_revenue))}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={TrendingUp} title="No sales data for this month yet" />
        )}
      </div>
    </div>
  );
}
