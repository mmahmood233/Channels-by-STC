// File purpose: Loads data for a protected dashboard module and renders its page UI.
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewSaleModal } from "@/features/sales/NewSaleModal";
import { VoidSaleButton } from "@/features/sales/VoidSaleButton";
import { ExportCsvButton } from "@/components/ui/ExportCsvButton";
import { PrintButton } from "@/components/ui/PrintButton";
import { ShoppingCart } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

// Loads data for this dashboard page and renders the matching feature UI.
export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; from?: string; to?: string; }>;
}) {
  const { supabase, profile } = await getCurrentUserProfile();

  const params = await searchParams;
  const isAdmin = profile.role === "admin";
  const isWarehouse = profile.role === "warehouse_manager";

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .eq("is_warehouse", false)
    .eq("status", "active")
    .order("name");

  const canSell = !isWarehouse;
  const activeStores = stores ?? [];
  const selectedStore =
    params.store ? activeStores.find((store) => store.id === params.store) : null;
  const defaultSaleStore = selectedStore ?? activeStores[0] ?? null;
  const saleStoreId = (profile.store_id as string | null) ?? (defaultSaleStore?.id ?? "");
  const saleStoreName =
    activeStores.find((store) => store.id === saleStoreId)?.name ?? "Selected store";
  const saleStoreOptions = profile.store_id
    ? activeStores.filter((store) => store.id === profile.store_id)
    : activeStores;

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
      {/* Header actions */}
      <div className="flex justify-end gap-2 no-print">
        {sales && sales.length > 0 && (
          <PrintButton />
        )}
        {sales && sales.length > 0 && (
          <ExportCsvButton
            filename="sales-report.csv"
            headers={["Date", "Store", "Sold By", "Total Amount (BHD)", "Units", "Notes"]}
            rows={(sales ?? []).map((sale) => {
              const items = (sale.sale_items as unknown as { quantity: number }[]) ?? [];
              const units = items.reduce((a, i) => a + i.quantity, 0);
              return [
                formatDate(sale.sale_date),
                (sale.stores as unknown as { name: string } | null)?.name ?? "",
                (sale.profiles as unknown as { full_name: string } | null)?.full_name ?? "",
                Number(sale.total_amount).toFixed(3),
                units,
                sale.notes ?? "",
              ];
            })}
          />
        )}
        {canSell && saleStoreId && (
          <NewSaleModal
            storeId={saleStoreId}
            storeName={saleStoreName}
            stores={saleStoreOptions.map((store) => ({
              id: store.id as string,
              name: store.name as string,
            }))}
          />
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Sales" value={String(sales?.length ?? 0)} />
        <SummaryCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
        <SummaryCard label="Units Sold" value={String(totalUnits)} />
        <SummaryCard label="Avg. Sale" value={sales?.length ? formatCurrency(totalRevenue / sales.length) : "—"} />
      </div>

      {/* Filters */}
      {(isAdmin || isWarehouse) && stores && stores.length > 0 && (
        <div className="flex flex-wrap gap-1.5 no-print">
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

      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <span className="text-xs font-medium text-surface-500">Date:</span>
        <input
          type="date"
          defaultValue={params.from ?? ""}
          max={params.to ?? new Date().toISOString().split("T")[0]}
          form="sales-date-form"
          name="from"
          className="rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-xs text-surface-700 focus:border-brand-400 focus:outline-none"
        />
        <span className="text-xs text-surface-400">to</span>
        <input
          type="date"
          defaultValue={params.to ?? ""}
          min={params.from ?? ""}
          max={new Date().toISOString().split("T")[0]}
          form="sales-date-form"
          name="to"
          className="rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-xs text-surface-700 focus:border-brand-400 focus:outline-none"
        />
        <form id="sales-date-form" method="get" action="/sales" className="flex gap-1.5">
          {params.store && <input type="hidden" name="store" value={params.store} />}
          <button type="submit" className="rounded-xl bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800">
            Apply
          </button>
          {(params.from || params.to) && (
            <a href={buildUrl("/sales", { store: params.store })} className="rounded-xl border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
              Clear
            </a>
          )}
        </form>
      </div>

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
                  {isAdmin && <Th><span className="sr-only">Actions</span></Th>}
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
                      {isAdmin && (
                        <Td>
                          <VoidSaleButton
                            saleId={sale.id as string}
                            isVoided={(sale.notes as string | null)?.startsWith("[VOIDED]") ?? false}
                          />
                        </Td>
                      )}
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

// Supports the application by connecting UI, data, or shared business logic.
function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white px-5 py-4 shadow-soft">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-surface-900">{value}</p>
    </div>
  );
}

// Supports the application by connecting UI, data, or shared business logic.
function buildUrl(base: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

// Supports the application by connecting UI, data, or shared business logic.
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

// Supports the application by connecting UI, data, or shared business logic.
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
      {children}
    </th>
  );
}

// Supports the application by connecting UI, data, or shared business logic.
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-surface-700", className)}>{children}</td>;
}
