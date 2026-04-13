import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AnalyticsCharts } from "@/features/analytics/AnalyticsCharts";
import { CURRENCY_SYMBOL } from "@/constants";
import { formatCurrency } from "@/utils/format";

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", session.user.id)
    .single();
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";
  const isWarehouse = profile.role === "warehouse_manager";

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split("T")[0];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  // Fetch data in parallel
  let salesQuery = supabase
    .from("monthly_sales_view")
    .select("store_id, store_name, device_id, device_name, sale_month, total_units_sold, total_revenue")
    .gte("sale_month", twelveMonthsAgo);

  if (!isAdmin && !isWarehouse && profile.store_id) {
    salesQuery = salesQuery.eq("store_id", profile.store_id);
  }

  const [
    { data: salesData },
    { data: topDevicesRaw },
    { data: inventoryRaw },
  ] = await Promise.all([
    salesQuery,
    supabase.from("top_selling_devices_view").select("device_id, device_name, total_units_sold, total_revenue").order("total_revenue", { ascending: false }).limit(10),
    supabase.from("current_inventory_view").select("device_id, quantity"),
  ]);

  // ── Revenue over time ──────────────────────────────────────────────────────
  const revenueByMonth: Record<string, number> = {};
  for (const row of salesData ?? []) {
    const key = (row.sale_month as string).slice(0, 7);
    revenueByMonth[key] = (revenueByMonth[key] ?? 0) + Number(row.total_revenue);
  }
  const revenueOverTime = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-BH", { month: "short", year: "2-digit" }),
      revenue,
    }));

  // ── Top devices by revenue ─────────────────────────────────────────────────
  const topDevices = (topDevicesRaw ?? []).map((d) => ({
    name: (d.device_name as string).length > 18
      ? (d.device_name as string).slice(0, 18) + "…"
      : (d.device_name as string),
    revenue: Number(d.total_revenue),
    units: d.total_units_sold as number,
  }));

  // ── Store comparison (current month) ──────────────────────────────────────
  const storeRevMap: Record<string, number> = {};
  for (const row of salesData ?? []) {
    if ((row.sale_month as string) >= startOfMonth) {
      const name = row.store_name as string;
      storeRevMap[name] = (storeRevMap[name] ?? 0) + Number(row.total_revenue);
    }
  }
  const storeComparison = Object.entries(storeRevMap)
    .sort(([, a], [, b]) => b - a)
    .map(([store, revenue]) => ({ store, revenue }));

  // ── Sell-through rate (current month) ─────────────────────────────────────
  const deviceSales: Record<string, { name: string; units: number }> = {};
  for (const row of salesData ?? []) {
    if ((row.sale_month as string) >= startOfMonth) {
      const id = row.device_id as string;
      deviceSales[id] = {
        name: row.device_name as string,
        units: (deviceSales[id]?.units ?? 0) + (row.total_units_sold as number),
      };
    }
  }
  const inventoryByDevice: Record<string, number> = {};
  for (const row of inventoryRaw ?? []) {
    const id = row.device_id as string;
    inventoryByDevice[id] = (inventoryByDevice[id] ?? 0) + (row.quantity as number);
  }
  const sellThrough = Object.entries(deviceSales)
    .map(([id, { name, units }]) => {
      const stock = inventoryByDevice[id] ?? 0;
      const rate = units + stock > 0 ? Math.round((units / (units + stock)) * 100) : 0;
      const shortName = name.length > 14 ? name.slice(0, 14) + "…" : name;
      return { name: shortName, rate, units };
    })
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10);

  // ── KPI summary ───────────────────────────────────────────────────────────
  const totalRevenue = (salesData ?? []).reduce((s, r) => s + Number(r.total_revenue), 0);
  const totalUnits = (salesData ?? []).reduce((s, r) => s + (r.total_units_sold as number), 0);
  const thisMonthRevenue = (salesData ?? [])
    .filter(r => (r.sale_month as string) >= startOfMonth)
    .reduce((s, r) => s + Number(r.total_revenue), 0);
  const uniqueStores = new Set((salesData ?? []).map(r => r.store_id)).size;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="12-Month Revenue" value={formatCurrency(totalRevenue)} />
        <KpiCard label="This Month" value={formatCurrency(thisMonthRevenue)} />
        <KpiCard label="Units Sold (12mo)" value={totalUnits.toLocaleString("en-BH")} />
        <KpiCard label="Active Stores" value={String(uniqueStores)} />
      </div>

      {/* Charts */}
      <AnalyticsCharts
        revenueOverTime={revenueOverTime}
        topDevices={topDevices}
        storeComparison={storeComparison}
        sellThrough={sellThrough}
        currency={CURRENCY_SYMBOL}
      />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white px-5 py-4 shadow-soft">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-surface-900">{value}</p>
    </div>
  );
}
