import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportCsvButton } from "@/components/ui/ExportCsvButton";
import { ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN:  "bg-purple-100 text-purple-700",
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; table?: string; user?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const params = await searchParams;

  // Fetch audit logs joined with profile for user name
  let query = supabase
    .from("audit_logs")
    .select("id, action, table_name, record_id, old_values, new_values, ip_address, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.action) query = query.eq("action", params.action);
  if (params.table)  query = query.eq("table_name", params.table);
  if (params.user)   query = query.eq("user_id", params.user);

  const { data: logs } = await query;

  // Fetch all profiles for name lookup
  const { data: profiles } = await supabase
    .from("profiles").select("id, full_name, email, role");
  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p])
  );

  // Unique tables for filter
  const tables = [...new Set((logs ?? []).map((l) => l.table_name).filter(Boolean))].sort();
  const actions = [...new Set((logs ?? []).map((l) => l.action).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-surface-500">Admin only · Read-only</p>
          </div>
        </div>
        {logs && logs.length > 0 && (
          <ExportCsvButton
            filename="audit-log.csv"
            headers={["Timestamp", "User", "Role", "Action", "Table", "Record ID", "IP"]}
            rows={(logs ?? []).map((l) => {
              const p = profileMap[l.user_id ?? ""];
              return [
                formatDateTime(l.created_at),
                p?.full_name ?? l.user_id ?? "System",
                p?.role ?? "",
                l.action,
                l.table_name ?? "",
                l.record_id ?? "",
                l.ip_address ?? "",
              ];
            })}
          />
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Events" value={String(logs?.length ?? 0)} />
        <SummaryCard label="Inserts" value={String(logs?.filter(l => l.action === "INSERT").length ?? 0)} />
        <SummaryCard label="Updates" value={String(logs?.filter(l => l.action === "UPDATE").length ?? 0)} />
        <SummaryCard label="Deletes" value={String(logs?.filter(l => l.action === "DELETE").length ?? 0)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip href="/audit-logs" active={!params.action && !params.table} label="All" />
        {actions.map((a) => (
          <FilterChip
            key={a}
            href={buildUrl("/audit-logs", { ...params, action: a ?? undefined })}
            active={params.action === a}
            label={a ?? ""}
            color={ACTION_COLORS[a ?? ""] ?? ""}
          />
        ))}
        {tables.length > 0 && <span className="w-px bg-surface-200 mx-1 self-stretch" />}
        {tables.map((t) => (
          <FilterChip
            key={t}
            href={buildUrl("/audit-logs", { ...params, table: t ?? undefined })}
            active={params.table === t}
            label={t ?? ""}
          />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {logs && logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <Th>Timestamp</Th>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Table</Th>
                  <Th>Record ID</Th>
                  <Th>Changes</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {logs.map((log) => {
                  const p = profileMap[log.user_id ?? ""];
                  const actionColor = ACTION_COLORS[log.action] ?? "bg-surface-100 text-surface-600";
                  const changes = summariseChanges(log.old_values, log.new_values);
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-surface-50/60">
                      <Td className="whitespace-nowrap text-xs text-surface-400">
                        {formatDateTime(log.created_at)}
                      </Td>
                      <Td>
                        {p ? (
                          <div>
                            <p className="font-medium text-surface-900">{p.full_name}</p>
                            <p className="text-xs text-surface-400">{p.role?.replace("_", " ")}</p>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-surface-400">
                            {log.user_id?.slice(0, 8) ?? "system"}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", actionColor)}>
                          {log.action}
                        </span>
                      </Td>
                      <Td>
                        <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-700">
                          {log.table_name ?? "—"}
                        </code>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-surface-400">
                          {log.record_id ? log.record_id.slice(0, 8) + "…" : "—"}
                        </span>
                      </Td>
                      <Td className="max-w-xs">
                        {changes ? (
                          <p className="truncate text-xs text-surface-500" title={changes}>{changes}</p>
                        ) : (
                          <span className="text-surface-300">—</span>
                        )}
                      </Td>
                      <Td className="text-xs text-surface-400">{log.ip_address ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="No audit events found"
            description="Actions taken in the system will be logged here"
          />
        )}
      </div>
    </div>
  );
}

function summariseChanges(
  oldVals: Record<string, unknown> | null,
  newVals: Record<string, unknown> | null
): string {
  if (!oldVals && !newVals) return "";
  if (!oldVals && newVals) {
    const keys = Object.keys(newVals).filter(k => k !== "id" && k !== "created_at" && k !== "updated_at");
    return keys.slice(0, 3).map(k => `${k}: ${String(newVals[k]).slice(0, 20)}`).join(", ");
  }
  if (oldVals && newVals) {
    const changed = Object.keys(newVals).filter(
      k => k !== "updated_at" && JSON.stringify(oldVals[k]) !== JSON.stringify(newVals[k])
    );
    return changed.slice(0, 3).map(k => `${k}: ${String(oldVals[k]).slice(0, 10)} → ${String(newVals[k]).slice(0, 10)}`).join(", ");
  }
  return "";
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white px-5 py-4 shadow-soft">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-surface-900">{value}</p>
    </div>
  );
}

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

function FilterChip({ href, active, label, color }: { href: string; active: boolean; label: string; color?: string }) {
  return (
    <a href={href} className={cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-brand-600 bg-brand-50 text-brand-700"
             : "border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50"
    )}>
      {label}
    </a>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-surface-400">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-surface-700", className)}>{children}</td>;
}
