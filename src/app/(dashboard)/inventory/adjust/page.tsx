import { requireWarehouseOrAdminProfile } from "@/lib/auth/current-user";
import { StockAdjustmentForm } from "@/features/inventory/StockAdjustmentForm";

export default async function StockAdjustmentPage() {
  const { supabase, profile } = await requireWarehouseOrAdminProfile();

  const [{ data: stores }, { data: devices }] = await Promise.all([
    supabase.from("stores").select("id, name, is_warehouse").eq("status", "active").order("name"),
    supabase.from("devices").select("id, name, brand, sku").eq("status", "active").order("brand").order("name"),
  ]);

  return (
    <StockAdjustmentForm
      stores={(stores ?? []).map(s => ({ id: s.id as string, name: s.name as string, is_warehouse: s.is_warehouse as boolean }))}
      devices={(devices ?? []).map(d => ({ id: d.id as string, name: d.name as string, brand: d.brand as string, sku: d.sku as string }))}
      defaultStoreId={(profile.store_id as string | null) ?? ""}
    />
  );
}
