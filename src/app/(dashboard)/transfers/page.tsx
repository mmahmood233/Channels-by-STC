import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArrowLeftRight } from "lucide-react";
import { formatDate } from "@/utils/format";
import { TRANSFER_STATUS_CONFIG } from "@/constants";
import { TransferActions } from "@/features/transfers/TransferActions";
import { cn } from "@/utils/cn";

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; store?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("id", session.user.id)
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
    .from("transfers")
    .select(`
      id, status, notes, transfer_date, created_at,
      from_store:source_store_id(id, name),
      to_store:destination_store_id(id, name),
      requester:requested_by(full_name),
      approver:approved_by(full_name),
      transfer_items(id, quantity, devices(name, sku))
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!isAdmin && !isWarehouse && profile.store_id) {
    query = query.or(
      `source_store_id.eq.${profile.store_id},destination_store_id.eq.${profile.store_id}`
    );
  } else if (params.store) {
    query = query.or(
      `source_store_id.eq.${params.store},destination_store_id.eq.${params.store}`
    );
  }

  if (params.status) query = query.eq("status", params.status);

  const { data: transfers } = await query;

  const statusCounts = Object.keys(TRANSFER_STATUS_CONFIG).reduce(
    (acc, s) => ({
      ...acc,
      [s]: transfers?.filter((t) => t.status === s).length ?? 0,
    }),
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        <FilterChip href="/transfers" active={!params.status} label="All" count={transfers?.length ?? 0} />
        {Object.entries(TRANSFER_STATUS_CONFIG).map(([s, cfg]) => (
          <FilterChip
            key={s}
            href={buildUrl("/transfers", { ...params, status: s })}
            active={params.status === s}
            label={cfg.label}
            count={statusCounts[s]}
          />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {transfers && transfers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <Th>From → To</Th>
                  <Th>Devices</Th>
                  <Th>Requested By</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {transfers.map((t) => {
                  const cfg = TRANSFER_STATUS_CONFIG[t.status as keyof typeof TRANSFER_STATUS_CONFIG];
                  const badgeVariant =
                    t.status === "completed" ? "success"
                    : t.status === "cancelled" ? "danger"
                    : t.status === "pending" ? "warning"
                    : "info";
                  const from = (t.from_store as { name: string } | null)?.name;
                  const to = (t.to_store as { name: string } | null)?.name;
                  const requester = (t.requester as { full_name: string } | null)?.full_name;
                  const items = (t.transfer_items as {
                    id: string;
                    quantity: number;
                    devices: { name: string; sku: string } | null;
                  }[]) ?? [];

                  return (
                    <tr key={t.id} className="transition-colors hover:bg-surface-50/60">
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-surface-900">{from ?? "?"}</span>
                          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                          <span className="font-medium text-surface-900">{to ?? "?"}</span>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          {items.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="text-xs text-surface-600">
                              {item.quantity}× {item.devices?.name ?? "?"}
                            </span>
                          ))}
                          {items.length > 2 && (
                            <span className="text-xs text-surface-400">+{items.length - 2} more</span>
                          )}
                          {items.length === 0 && (
                            <span className="text-xs text-surface-400">No items</span>
                          )}
                        </div>
                      </Td>
                      <Td>{requester ?? "—"}</Td>
                      <Td className="whitespace-nowrap">
                        {t.transfer_date
                          ? formatDate(t.transfer_date)
                          : formatDate(t.created_at)}
                      </Td>
                      <Td>
                        <Badge variant={badgeVariant as "success" | "danger" | "warning" | "info"}>
                          {cfg?.label ?? t.status}
                        </Badge>
                      </Td>
                      <Td>
                        <TransferActions
                          transferId={t.id}
                          status={t.status}
                          userRole={profile.role}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transfers found"
            description="Transfers will appear here once requested"
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

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <a
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
          active ? "bg-brand-100 text-brand-700" : "bg-surface-100 text-surface-500"
        )}>
          {count}
        </span>
      )}
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
