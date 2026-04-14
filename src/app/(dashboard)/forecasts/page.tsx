import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/utils/cn";

export default async function ForecastsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; risk?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const isAdmin = profile.role === "admin";
  const isWarehouse = profile.role === "warehouse_manager";

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  let query = supabase
    .from("forecast_vs_inventory_view")
    .select("*")
    .order("stock_gap")
    .limit(200);

  if (!isAdmin && !isWarehouse && profile.store_id) {
    query = query.eq("store_id", profile.store_id);
  } else if (params.store) {
    query = query.eq("store_id", params.store);
  }

  if (params.risk) query = query.eq("risk_level", params.risk);

  const { data: forecasts } = await query;

  const shortageCount = forecasts?.filter((f) => f.risk_level === "shortage_expected").length ?? 0;
  const atRiskCount = forecasts?.filter((f) => f.risk_level === "at_risk").length ?? 0;
  const sufficientCount = forecasts?.filter((f) => f.risk_level === "sufficient").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Risk summary */}
      <div className="grid grid-cols-3 gap-4">
        <RiskCard
          label="Shortage Expected"
          count={shortageCount}
          color="red"
          icon={<TrendingDown className="h-5 w-5" />}
        />
        <RiskCard
          label="At Risk"
          count={atRiskCount}
          color="amber"
          icon={<Minus className="h-5 w-5" />}
        />
        <RiskCard
          label="Sufficient Stock"
          count={sufficientCount}
          color="green"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(isAdmin || isWarehouse) && stores && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip href="/forecasts" active={!params.store} label="All Stores" />
            {stores.map((s) => (
              <FilterChip
                key={s.id}
                href={buildUrl("/forecasts", { ...params, store: s.id })}
                active={params.store === s.id}
                label={s.name}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip href={buildUrl("/forecasts", { ...params, risk: undefined })} active={!params.risk} label="All" />
        <FilterChip href={buildUrl("/forecasts", { ...params, risk: "shortage_expected" })} active={params.risk === "shortage_expected"} label="Shortage Expected" />
        <FilterChip href={buildUrl("/forecasts", { ...params, risk: "at_risk" })} active={params.risk === "at_risk"} label="At Risk" />
        <FilterChip href={buildUrl("/forecasts", { ...params, risk: "sufficient" })} active={params.risk === "sufficient"} label="Sufficient" />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {forecasts && forecasts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <Th>Device</Th>
                  {(isAdmin || isWarehouse) && <Th>Store</Th>}
                  <Th>Period</Th>
                  <Th>Predicted Demand</Th>
                  <Th>Current Stock</Th>
                  <Th>Gap</Th>
                  <Th>Confidence</Th>
                  <Th>Risk</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {forecasts.map((f) => {
                  const gap = f.stock_gap;
                  const riskVariant =
                    f.risk_level === "shortage_expected" ? "danger"
                    : f.risk_level === "at_risk" ? "warning"
                    : "success";
                  const riskLabel =
                    f.risk_level === "shortage_expected" ? "Shortage Expected"
                    : f.risk_level === "at_risk" ? "At Risk"
                    : "Sufficient";

                  return (
                    <tr
                      key={f.forecast_id}
                      className={cn(
                        "transition-colors hover:bg-surface-50/60",
                        f.risk_level === "shortage_expected" && "bg-red-50/20"
                      )}
                    >
                      <Td className="font-medium text-surface-900">{f.device_name}</Td>
                      {(isAdmin || isWarehouse) && (
                        <Td>{f.store_name ?? "Global"}</Td>
                      )}
                      <Td className="whitespace-nowrap text-xs text-surface-500">
                        {new Date(f.forecast_period).toLocaleDateString("en-BH", {
                          month: "long",
                          year: "numeric",
                        })}
                      </Td>
                      <Td className="font-semibold">{f.predicted_quantity}</Td>
                      <Td>
                        <span
                          className={cn(
                            "font-bold",
                            f.current_stock === 0 ? "text-red-600"
                            : f.current_stock < f.predicted_quantity ? "text-amber-600"
                            : "text-green-600"
                          )}
                        >
                          {f.current_stock}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            "font-semibold",
                            gap >= 0 ? "text-green-600" : "text-red-600"
                          )}
                        >
                          {gap >= 0 ? "+" : ""}{gap}
                        </span>
                      </Td>
                      <Td>
                        {f.confidence_score !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-100">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  f.confidence_score >= 0.7 ? "bg-green-500"
                                  : f.confidence_score >= 0.4 ? "bg-amber-500"
                                  : "bg-red-500"
                                )}
                                style={{ width: `${(f.confidence_score * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="text-xs text-surface-500">
                              {(f.confidence_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : "—"}
                      </Td>
                      <Td>
                        <Badge variant={riskVariant as "danger" | "warning" | "success"}>
                          {riskLabel}
                        </Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No forecasts available"
            description="Run the forecasting script to generate predictions"
          />
        )}
      </div>
    </div>
  );
}

function RiskCard({
  label, count, color, icon,
}: {
  label: string;
  count: number;
  color: "red" | "amber" | "green";
  icon: React.ReactNode;
}) {
  const colors = {
    red: "border-red-100 bg-red-50 text-red-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    green: "border-green-100 bg-green-50 text-green-700",
  };
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-4", colors[color])}>
      {icon}
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs font-medium">{label}</p>
      </div>
    </div>
  );
}

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50"
      )}
    >
      {label}
    </a>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-surface-700", className)}>{children}</td>;
}
