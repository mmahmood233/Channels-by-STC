import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewTransferModal } from "@/features/transfers/NewTransferModal";
import { ExportCsvButton } from "@/components/ui/ExportCsvButton";
import { PrintButton } from "@/components/ui/PrintButton";
import { Package, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; status?: string }>;
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

  // Stores for filter (admin/warehouse sees all)
  const { data: storesRaw } = await supabase
    .from("stores")
    .select("id, name, is_warehouse")
    .eq("status", "active")
    .order("name");
  const stores = storesRaw ?? [];

  // Source store for the transfer modal
  const sourceStoreId = (profile.store_id as string | null) ??
    (stores.find((s) => s.is_warehouse)?.id ?? stores[0]?.id ?? "");
  const { data: sourceInventory } = await supabase
    .from("current_inventory_view")
    .select("device_id, device_name, brand, sku, quantity")
    .eq("store_id", sourceStoreId)
    .gt("quantity", 0)
    .order("device_name");
  const modalInventory = (sourceInventory ?? []).map((r) => ({
    id: r.device_id as string, name: r.device_name as string, brand: r.brand as string,
    sku: r.sku as string, quantity: r.quantity as number,
  }));
  const modalStores = stores.map((s) => ({
    id: s.id as string, name: s.name as string, is_warehouse: s.is_warehouse as boolean,
  }));

  // Build query on view
  let query = supabase
    .from("current_inventory_view")
    .select("*")
    .order("store_name")
    .order("brand")
    .order("device_name");

  // Role scoping
  if (!isAdmin && !isWarehouse && profile.store_id) {
    query = query.eq("store_id", profile.store_id);
  } else if (params.store) {
    query = query.eq("store_id", params.store);
  }

  if (params.status) {
    query = query.eq("stock_status", params.status);
  }

  const { data: inventory } = await query;

  const outCount = inventory?.filter((r) => r.stock_status === "out_of_stock").length ?? 0;
  const lowCount = inventory?.filter((r) => r.stock_status === "low_stock").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex justify-end gap-2 no-print">
        {inventory && inventory.length > 0 && <PrintButton />}
        {inventory && inventory.length > 0 && (
          <ExportCsvButton
            filename="inventory-report.csv"
            headers={["Store", "SKU", "Device", "Brand", "Category", "Qty", "Threshold", "Status"]}
            rows={(inventory ?? []).map((row) => [
              row.store_name,
              row.sku,
              row.device_name,
              row.brand,
              row.category_name,
              row.quantity,
              row.low_stock_threshold,
              row.stock_status,
            ])}
          />
        )}
        {sourceStoreId && (
          <NewTransferModal
            currentStoreId={sourceStoreId}
            allStores={modalStores}
            inventoryAtCurrentStore={modalInventory}
            userRole={profile.role as string}
          />
        )}
      </div>

      {/* Summary pills */}
      {(outCount > 0 || lowCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {outCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">
                {outCount} out of stock
              </span>
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">
                {lowCount} low stock
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {(isAdmin || isWarehouse) && stores.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip href="/inventory" active={!params.store} label="All Stores" />
            {stores.map((s) => (
              <FilterChip
                key={s.id}
                href={buildUrl("/inventory", { ...params, store: s.id })}
                active={params.store === s.id}
                label={s.name}
              />
            ))}
          </div>
        )}

        <div className="flex gap-1.5">
          <FilterChip href={buildUrl("/inventory", { ...params, status: undefined })} active={!params.status} label="All" />
          <FilterChip href={buildUrl("/inventory", { ...params, status: "in_stock" })} active={params.status === "in_stock"} label="In Stock" />
          <FilterChip href={buildUrl("/inventory", { ...params, status: "low_stock" })} active={params.status === "low_stock"} label="Low Stock" />
          <FilterChip href={buildUrl("/inventory", { ...params, status: "out_of_stock" })} active={params.status === "out_of_stock"} label="Out of Stock" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {inventory && inventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  {(isAdmin || isWarehouse) && <Th>Store</Th>}
                  <Th>SKU</Th>
                  <Th>Device</Th>
                  <Th>Brand</Th>
                  <Th>Category</Th>
                  <Th>Qty</Th>
                  <Th>Threshold</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {inventory.map((row) => (
                  <tr
                    key={row.inventory_id}
                    className={cn(
                      "transition-colors hover:bg-surface-50/60",
                      row.stock_status === "out_of_stock" && "bg-red-50/30",
                      row.stock_status === "low_stock" && "bg-amber-50/20"
                    )}
                  >
                    {(isAdmin || isWarehouse) && (
                      <Td>
                        <div className="flex items-center gap-2">
                          <span>{row.store_name}</span>
                          {row.is_warehouse && (
                            <Badge variant="purple">WH</Badge>
                          )}
                        </div>
                      </Td>
                    )}
                    <Td>
                      <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-mono">
                        {row.sku}
                      </code>
                    </Td>
                    <Td className="font-medium text-surface-900">{row.device_name}</Td>
                    <Td>{row.brand}</Td>
                    <Td className="text-surface-500">{row.category_name}</Td>
                    <Td>
                      <span
                        className={cn(
                          "font-bold",
                          row.stock_status === "out_of_stock"
                            ? "text-red-600"
                            : row.stock_status === "low_stock"
                            ? "text-amber-600"
                            : "text-surface-900"
                        )}
                      >
                        {row.quantity}
                      </span>
                    </Td>
                    <Td className="text-surface-500">{row.low_stock_threshold}</Td>
                    <Td>
                      <StockBadge status={row.stock_status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="No inventory records"
            description="Try adjusting your filters"
          />
        )}
      </div>
    </div>
  );
}

function StockBadge({ status }: { status: string }) {
  if (status === "out_of_stock")
    return <Badge variant="danger">Out of Stock</Badge>;
  if (status === "low_stock")
    return <Badge variant="warning">Low Stock</Badge>;
  return <Badge variant="success">In Stock</Badge>;
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
