import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/utils/format";
import { ALERT_SEVERITY_CONFIG, ALERT_STATUS_CONFIG } from "@/constants";
import { AlertActions } from "@/features/alerts/AlertActions";
import { cn } from "@/utils/cn";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>;
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

  let query = supabase
    .from("alerts")
    .select(`
      id, alert_type, severity, status, title, message,
      current_quantity, threshold, created_at, resolved_at,
      stores(name),
      devices(name, sku),
      resolver:resolved_by(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdmin && !isWarehouse && profile.store_id) {
    query = query.eq("store_id", profile.store_id);
  }

  if (params.status) {
    query = query.eq("status", params.status);
  } else {
    // Default: show active + acknowledged
    query = query.in("status", ["active", "acknowledged"]);
  }

  if (params.severity) query = query.eq("severity", params.severity);

  const { data: alerts } = await query;

  return (
    <div className="space-y-6">
      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          href="/alerts"
          active={!params.status}
          label="Active & Acknowledged"
        />
        {Object.entries(ALERT_STATUS_CONFIG).map(([s, cfg]) => (
          <FilterChip
            key={s}
            href={buildUrl("/alerts", { ...params, status: s })}
            active={params.status === s}
            label={cfg.label}
          />
        ))}
      </div>

      {/* Severity filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          href={buildUrl("/alerts", { ...params, severity: undefined })}
          active={!params.severity}
          label="All Severities"
        />
        {Object.entries(ALERT_SEVERITY_CONFIG).map(([s, cfg]) => (
          <FilterChip
            key={s}
            href={buildUrl("/alerts", { ...params, severity: s })}
            active={params.severity === s}
            label={cfg.label}
          />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {alerts && alerts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <Th>Alert</Th>
                  <Th>Store</Th>
                  <Th>Device</Th>
                  <Th>Stock</Th>
                  <Th>Severity</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {alerts.map((alert) => {
                  const sev = ALERT_SEVERITY_CONFIG[alert.severity as keyof typeof ALERT_SEVERITY_CONFIG];
                  const st = ALERT_STATUS_CONFIG[alert.status as keyof typeof ALERT_STATUS_CONFIG];
                  const sevVariant =
                    alert.severity === "critical" || alert.severity === "high" ? "danger"
                    : alert.severity === "medium" ? "warning"
                    : "info";
                  const stVariant =
                    alert.status === "active" ? "danger"
                    : alert.status === "acknowledged" ? "warning"
                    : alert.status === "resolved" ? "success"
                    : "default";

                  return (
                    <tr
                      key={alert.id}
                      className={cn(
                        "transition-colors hover:bg-surface-50/60",
                        alert.severity === "critical" && alert.status === "active" && "bg-red-50/20"
                      )}
                    >
                      <Td>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            alert.severity === "critical" ? "text-red-500"
                            : alert.severity === "high" ? "text-orange-500"
                            : alert.severity === "medium" ? "text-amber-500"
                            : "text-blue-400"
                          )} />
                          <div>
                            <p className="font-medium text-surface-900">{alert.title}</p>
                            {alert.message && (
                              <p className="text-xs text-surface-400 mt-0.5 max-w-xs truncate">
                                {alert.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td>{(alert.stores as unknown as { name: string } | null)?.name ?? "—"}</Td>
                      <Td>
                        {(alert.devices as unknown as { name: string; sku: string } | null)
                          ? (
                            <div>
                              <p className="font-medium">
                                {(alert.devices as unknown as { name: string }).name}
                              </p>
                              <code className="text-xs text-surface-400">
                                {(alert.devices as unknown as { sku: string }).sku}
                              </code>
                            </div>
                          )
                          : "—"}
                      </Td>
                      <Td>
                        {alert.current_quantity !== null ? (
                          <span className={cn(
                            "font-bold",
                            alert.current_quantity === 0 ? "text-red-600" : "text-amber-600"
                          )}>
                            {alert.current_quantity}
                            {alert.threshold !== null && (
                              <span className="ml-1 text-xs font-normal text-surface-400">
                                / {alert.threshold}
                              </span>
                            )}
                          </span>
                        ) : "—"}
                      </Td>
                      <Td>
                        <Badge variant={sevVariant as "danger" | "warning" | "info"}>
                          {sev?.label ?? alert.severity}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge variant={stVariant as "danger" | "warning" | "success" | "default"}>
                          {st?.label ?? alert.status}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-surface-400">
                        {formatDateTime(alert.created_at)}
                      </Td>
                      <Td>
                        <AlertActions alertId={alert.id} status={alert.status} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Bell}
            title="No alerts"
            description="System alerts will appear here"
          />
        )}
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
