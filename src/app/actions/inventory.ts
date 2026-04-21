"use server";

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

  // Get current inventory row
  const { data: inv } = await supabase
    .from("inventory")
    .select("id, quantity")
    .eq("store_id", data.store_id)
    .eq("device_id", data.device_id)
    .single();

  if (!inv) return { error: "No inventory record found for this device/store" };

  const newQty = inv.quantity + data.adjustment;
  if (newQty < 0) return { error: `Cannot reduce below 0. Current stock: ${inv.quantity}` };

  const { error: updateErr } = await supabase
    .from("inventory")
    .update({ quantity: newQty })
    .eq("id", inv.id);

  if (updateErr) return { error: updateErr.message };

  await supabase.from("stock_movements").insert({
    store_id: data.store_id,
    device_id: data.device_id,
    movement_type: "adjustment",
    quantity: data.adjustment,
    reference_type: "manual_adjustment",
    notes: data.reason,
    performed_by: user.id,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, newQuantity: newQty };
}
