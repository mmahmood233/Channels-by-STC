import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NewTransferModal } from "@/features/transfers/NewTransferModal";
import { ExportCsvButton } from "@/components/ui/ExportCsvButton";
import { PrintButton } from "@/components/ui/PrintButton";
import { InventoryTable } from "@/features/inventory/InventoryTable";
import { AlertTriangle } from "lucide-react";
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

  const { data: storesRaw } = await supabase
    .from("stores")
    .select("id, name, is_warehouse")
    .eq("status", "active")
    .order("name");
  const stores = storesRaw ?? [];

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

  let query = supabase
    .from("current_inventory_view")
    .select("*")
    .order("store_name")
    .order("brand")
    .order("device_name");

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

  const inventoryRows = (inventory ?? []).map((row) => ({
    inventory_id: row.inventory_id as string,
    store_id: row.store_id as string,
    store_name: row.store_name as string,
    is_warehouse: row.is_warehouse as boolean,
    device_id: row.device_id as string,
    device_name: row.device_name as string,
    sku: row.sku as string,
    brand: row.brand as string,
    category_name: row.category_name as string | null,
    quantity: row.quantity as number,
    low_stock_threshold: row.low_stock_threshold as number,
    stock_status: row.stock_status as string,
  }));

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">{inventoryRows.length} records</p>
        <div className="flex flex-wrap justify-end gap-2 no-print">
          {inventoryRows.length > 0 && <PrintButton />}
          {inventoryRows.length > 0 && (
            <ExportCsvButton
              filename="inventory-report.csv"
              headers={["Store", "SKU", "Device", "Brand", "Category", "Qty", "Threshold", "Status"]}
              rows={inventoryRows.map((row) => [
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
          {(isAdmin || isWarehouse) && (
            <a
              href="/inventory/adjust"
              className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50"
            >
              Adjust Stock
            </a>
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
      </div>

      {/* Summary pills */}
      {(outCount > 0 || lowCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {outCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">{outCount} out of stock</span>
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">{lowCount} low stock</span>
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

      <InventoryTable rows={inventoryRows} isAdmin={isAdmin} isWarehouse={isWarehouse} />
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
