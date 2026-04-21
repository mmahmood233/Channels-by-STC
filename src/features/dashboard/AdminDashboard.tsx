import {
  Smartphone, Package, ShoppingCart, ArrowLeftRight,
  Bell, TrendingUp, AlertTriangle, CheckCircle2, Clock, DollarSign,
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
  userName: string;
}

export async function AdminDashboard({ userId, userName }: Props) {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const startOfMonth    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const startLastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const endLastMonth    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  const [
    { count: totalDevices },
    { count: lowStockCount },
    { count: activeAlerts },
    { count: pendingTransfers },
    { data: recentSales },
    { data: recentAlerts },
    { data: recentTransfers },
    { data: salesThisMonth },
    { data: salesLastMonth },
    { data: allStores },
    { data: devicesForModal },
    { data: inventoryForModal },
  ] = await Promise.all([
    supabase.from("devices").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("current_inventory_view").select("inventory_id", { count: "exact", head: true })
      .in("stock_status", ["low_stock", "out_of_stock"]),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("transfers").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("sales").select("id, sale_date, total_amount, stores(name)")
      .order("sale_date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    supabase.from("alerts").select("id, title, severity, created_at, stores(name)")
      .eq("status", "active").order("created_at", { ascending: false }).limit(5),
    supabase.from("transfers")
      .select("id, status, created_at, from_store:source_store_id(name), to_store:destination_store_id(name)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("sales").select("total_amount").gte("sale_date", startOfMonth),
    supabase.from("sales").select("total_amount").gte("sale_date", startLastMonth).lte("sale_date", endLastMonth),
    supabase.from("stores").select("id, name, is_warehouse").eq("status", "active").order("name"),
    supabase.from("devices").select("id, name, brand, sku, unit_price").eq("status", "active").order("brand").order("name"),
    supabase.from("current_inventory_view").select("device_id, device_name, brand, sku, quantity, store_id")
      .gt("quantity", 0).order("device_name"),
  ]);

  const monthlyRevenue   = salesThisMonth?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0;
  const lastMonthRevenue = salesLastMonth?.reduce((s, r) => s + Number(r.total_amount), 0) ?? 0;
  const revTrend = lastMonthRevenue > 0
    ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null;
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const firstName = userName.split(" ")[0];

  const modalDevices = (devicesForModal ?? []).map((d) => ({
    id: d.id as string, name: d.name as string, brand: d.brand as string,
    sku: d.sku as string, unit_price: Number(d.unit_price),
  }));
  const modalStores = (allStores ?? []).map((s) => ({
    id: s.id as string, name: s.name as string, is_warehouse: s.is_warehouse as boolean,
  }));
  const firstStoreId = modalStores.find((s) => !s.is_warehouse)?.id ?? modalStores[0]?.id ?? "";
  const modalInventory = (inventoryForModal ?? [])
    .filter((r) => r.store_id === firstStoreId)
    .map((r) => ({
      id: r.device_id as string, name: r.device_name as string, brand: r.brand as string,
      sku: r.sku as string, quantity: r.quantity as number,
    }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">{greeting}, {firstName} 👋</h2>
          <p className="mt-1 text-sm text-surface-500">
            Network overview · {formatDate(now.toISOString().split("T")[0])}
          </p>
        </div>
        <div className="flex gap-3">
          <NewSaleModal storeId={firstStoreId} devices={modalDevices} />
          <NewTransferModal
            currentStoreId={firstStoreId}
            allStores={modalStores}
            inventoryAtCurrentStore={modalInventory}
            userRole="admin"
          />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Device SKUs" value={totalDevices ?? 0} subtitle="Active catalogue" icon={Smartphone} iconColor="text-brand-600" iconBg="bg-brand-50" />
        <StatCard title="Monthly Revenue" value={formatCurrency(monthlyRevenue)} subtitle="This month" icon={DollarSign} iconColor="text-green-600" iconBg="bg-green-50"
          trend={revTrend !== null ? { value: revTrend, label: "vs last month" } : undefined} />
        <StatCard title="Low / Out of Stock" value={lowStockCount ?? 0} subtitle="Need restocking" icon={Package}
          iconColor={(lowStockCount ?? 0) > 0 ? "text-amber-600" : "text-green-600"}
          iconBg={(lowStockCount ?? 0) > 0 ? "bg-amber-50" : "bg-green-50"} />
        <StatCard title="Active Alerts" value={activeAlerts ?? 0} subtitle="Require attention" icon={Bell}
          iconColor={(activeAlerts ?? 0) > 0 ? "text-red-600" : "text-green-600"}
          iconBg={(activeAlerts ?? 0) > 0 ? "bg-red-50" : "bg-green-50"} />
        <StatCard title="Pending Transfers" value={pendingTransfers ?? 0} subtitle="Awaiting approval" icon={ArrowLeftRight} iconColor="text-purple-600" iconBg="bg-purple-50" />
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Recent Sales" icon={<ShoppingCart className="h-4 w-4 text-surface-400" />} href="/sales">
          {recentSales && recentSales.length > 0 ? recentSales.map((sale) => (
            <PanelRow key={sale.id}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-surface-900">{formatCurrency(Number(sale.total_amount))}</p>
                <p className="truncate text-xs text-surface-400">
                  {formatDate(sale.sale_date)}
                  {sale.stores ? ` · ${(sale.stores as unknown as { name: string }).name}` : ""}
                </p>
              </div>
            </PanelRow>
          )) : <EmptyRow />}
        </Panel>

        <Panel title="Active Alerts" icon={<Bell className="h-4 w-4 text-surface-400" />} href="/alerts">
          {recentAlerts && recentAlerts.length > 0 ? recentAlerts.map((alert) => {
            const sev = ALERT_SEVERITY_CONFIG[alert.severity as keyof typeof ALERT_SEVERITY_CONFIG];
            const v = alert.severity === "critical" || alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "info";
            return (
              <PanelRow key={alert.id}>
                <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", alert.severity === "critical" ? "text-red-500" : "text-amber-500")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-surface-900">{alert.title}</p>
                  <p className="text-xs text-surface-400">
                    {(alert.stores as unknown as { name: string } | null)?.name} · {formatDate(alert.created_at)}
                  </p>
                </div>
                <Badge variant={v as "danger" | "warning" | "info"}>{sev?.label ?? alert.severity}</Badge>
              </PanelRow>
            );
          }) : <EmptyRow icon="check" />}
        </Panel>

        <Panel title="Transfers" icon={<ArrowLeftRight className="h-4 w-4 text-surface-400" />} href="/transfers">
          {recentTransfers && recentTransfers.length > 0 ? recentTransfers.map((t) => {
            const cfg = TRANSFER_STATUS_CONFIG[t.status as keyof typeof TRANSFER_STATUS_CONFIG];
            const v = t.status === "completed" ? "success" : t.status === "cancelled" ? "danger" : t.status === "pending" ? "warning" : "info";
            return (
              <PanelRow key={t.id}>
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-surface-900">
                    <span className="font-medium">{(t.from_store as unknown as { name: string } | null)?.name ?? "?"}</span>
                    <span className="mx-1 text-surface-400">→</span>
                    <span className="font-medium">{(t.to_store as unknown as { name: string } | null)?.name ?? "?"}</span>
                  </p>
                  <p className="text-xs text-surface-400">{formatDate(t.created_at)}</p>
                </div>
                <Badge variant={v as "success" | "danger" | "warning" | "info"}>{cfg?.label ?? t.status}</Badge>
              </PanelRow>
            );
          }) : <EmptyRow />}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon, href, children }: { title: string; icon: React.ReactNode; href: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
        <div className="flex items-center gap-2">{icon}<h3 className="font-semibold text-surface-900">{title}</h3></div>
        <a href={href} className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</a>
      </div>
      <div className="divide-y divide-surface-50">{children}</div>
    </div>
  );
}
function PanelRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-3 px-6 py-3">{children}</div>;
}
function EmptyRow({ icon }: { icon?: "check" }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon === "check" ? <CheckCircle2 className="mb-2 h-8 w-8 text-green-400" /> : <TrendingUp className="mb-2 h-8 w-8 text-surface-200" />}
      <p className="text-sm text-surface-400">Nothing here yet</p>
    </div>
  );
}
