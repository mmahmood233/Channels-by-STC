import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StockAdjustmentForm } from "@/features/inventory/StockAdjustmentForm";

export default async function StockAdjustmentPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role, store_id").eq("id", user.id).single();

  if (profile?.role !== "admin" && profile?.role !== "warehouse_manager") {
    redirect("/inventory");
  }

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
