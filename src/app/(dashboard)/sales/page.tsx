import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewSaleModal } from "@/features/sales/NewSaleModal";
import { ShoppingCart } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; from?: string; to?: string }>;
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
    .eq("is_warehouse", false)
    .eq("status", "active")
    .order("name");

  // Devices for the New Sale modal (store managers and admins can record sales)
  const canSell = !isWarehouse;
  const { data: devicesForModal } = canSell
    ? await supabase.from("devices").select("id, name, brand, sku, unit_price").eq("status", "active").order("brand").order("name")
    : { data: null };
  const modalDevices = (devicesForModal ?? []).map((d) => ({
    id: d.id as string, name: d.name as string, brand: d.brand as string,
    sku: d.sku as string, unit_price: Number(d.unit_price),
  }));
  const saleStoreId = (profile.store_id as string | null) ?? (stores?.[0]?.id ?? "");

  let query = supabase
    .from("sales")
    .select(`
      id, sale_date, total_amount, notes,
      stores(name),
      profiles(full_name),
      sale_items(id, quantity, unit_price, line_total, devices(name, sku))
    `)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (!isAdmin && !isWarehouse && profile.store_id) {
    query = query.eq("store_id", profile.store_id);
  } else if (params.store) {
    query = query.eq("store_id", params.store);
  }

  if (params.from) query = query.gte("sale_date", params.from);
  if (params.to) query = query.lte("sale_date", params.to);

  const { data: sales } = await query;

  const totalRevenue =
    sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) ?? 0;
  const totalUnits =
    sales?.reduce(
      (sum, s) =>
        sum +
        ((s.sale_items as unknown as { quantity: number }[]) ?? []).reduce(
          (a, i) => a + i.quantity,
          0
        ),
      0
    ) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header with action */}
      {canSell && saleStoreId && (
        <div className="flex justify-end">
          <NewSaleModal storeId={saleStoreId} devices={modalDevices} />
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Sales" value={String(sales?.length ?? 0)} />
        <SummaryCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
        <SummaryCard label="Units Sold" value={String(totalUnits)} />
        <SummaryCard label="Avg. Sale" value={sales?.length ? formatCurrency(totalRevenue / sales.length) : "—"} />
      </div>

      {/* Filters */}
      {(isAdmin || isWarehouse) && stores && stores.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip href="/sales" active={!params.store} label="All Stores" />
          {stores.map((s) => (
            <FilterChip
              key={s.id}
              href={buildUrl("/sales", { ...params, store: s.id })}
              active={params.store === s.id}
              label={s.name}
            />
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {sales && sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <Th>Date</Th>
                  {(isAdmin || isWarehouse) && <Th>Store</Th>}
                  <Th>Sold By</Th>
                  <Th>Items</Th>
                  <Th>Units</Th>
                  <Th>Total</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {sales.map((sale) => {
                  const items = (sale.sale_items as unknown as {
                    id: string;
                    quantity: number;
                    unit_price: number;
                    line_total: number;
                    devices: { name: string; sku: string } | null;
                  }[]) ?? [];
                  const totalUnits = items.reduce((a, i) => a + i.quantity, 0);
                  return (
                    <tr
                      key={sale.id}
                      className="transition-colors hover:bg-surface-50/60"
                    >
                      <Td className="whitespace-nowrap font-medium">
                        {formatDate(sale.sale_date)}
                      </Td>
                      {(isAdmin || isWarehouse) && (
                        <Td>
                          {(sale.stores as unknown as { name: string } | null)?.name ?? "—"}
                        </Td>
                      )}
                      <Td>
                        {(sale.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          {items.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="text-xs text-surface-600">
                              {item.quantity}× {item.devices?.name ?? "?"}
                            </span>
                          ))}
                          {items.length > 2 && (
                            <span className="text-xs text-surface-400">
                              +{items.length - 2} more
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td>{totalUnits}</Td>
                      <Td className="font-bold text-surface-900">
                        {formatCurrency(Number(sale.total_amount))}
                      </Td>
                      <Td className="max-w-xs truncate text-surface-400 text-xs">
                        {sale.notes ?? "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="No sales found"
            description="Sales will appear here once recorded"
          />
        )}
      </div>
    </div>
  );
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
