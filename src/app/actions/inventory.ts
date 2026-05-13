"use server";

// Server action for manual stock adjustments (admin + warehouse manager only)
// Positive adjustment = add stock, negative = remove stock.
// The database RPC keeps inventory and stock movement logs atomic.
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function adjustStock(data: {
  store_id: string;
  device_id: string;
  adjustment: number; // positive = add, negative = remove
  reason: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "warehouse_manager") {
    return { error: "Admin or warehouse manager only" };
  }

  if (data.adjustment === 0) return { error: "Adjustment cannot be zero" };
  if (!data.reason.trim()) return { error: "Reason is required" };

  const { data: newQuantity, error } = await supabase.rpc("adjust_stock_atomic", {
    p_store_id: data.store_id,
    p_device_id: data.device_id,
    p_adjustment: data.adjustment,
    p_reason: data.reason.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return { success: true, newQuantity };
}
