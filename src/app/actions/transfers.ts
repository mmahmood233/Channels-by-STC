"use server";

// Server actions for transfer status management
// Transfer lifecycle: pending → approved → in_transit → completed (or cancelled at any step)
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveTransfer(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "warehouse_manager")) {
    return { error: "Permission denied" };
  }

  const { error } = await supabase
    .from("transfers")
    .update({ status: "approved", approved_by: user.id })
    .eq("id", transferId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}

export async function rejectTransfer(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "warehouse_manager")) {
    return { error: "Permission denied" };
  }

  const { error } = await supabase
    .from("transfers")
    .update({ status: "cancelled" })
    .eq("id", transferId)
    .in("status", ["pending", "approved"]);

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}

export async function markInTransit(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("transfers")
    .update({ status: "in_transit" })
    .eq("id", transferId)
    .eq("status", "approved");

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}

export async function completeTransfer(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Fetch transfer header + all line items
  const { data: transfer, error: fetchErr } = await supabase
    .from("transfers")
    .select("id, source_store_id, destination_store_id, status, transfer_items(device_id, quantity)")
    .eq("id", transferId)
    .eq("status", "in_transit")
    .single();

  if (fetchErr || !transfer) return { error: "Transfer not found or not in transit" };

  const items = transfer.transfer_items as { device_id: string; quantity: number }[];

  // Move stock for each item
  for (const item of items) {
    // Decrement source inventory
    const { data: srcInv } = await supabase
      .from("inventory")
      .select("id, quantity")
      .eq("store_id", transfer.source_store_id)
      .eq("device_id", item.device_id)
      .single();

    if (!srcInv || srcInv.quantity < item.quantity) {
      return { error: "Insufficient stock at source store — cannot complete transfer" };
    }

    const { error: srcErr } = await supabase
      .from("inventory")
      .update({ quantity: srcInv.quantity - item.quantity })
      .eq("id", srcInv.id);

    if (srcErr) return { error: srcErr.message };

    // Increment destination inventory (create row if it doesn't exist yet)
    const { data: dstInv } = await supabase
      .from("inventory")
      .select("id, quantity")
      .eq("store_id", transfer.destination_store_id)
      .eq("device_id", item.device_id)
      .single();

    if (dstInv) {
      const { error: dstErr } = await supabase
        .from("inventory")
        .update({ quantity: dstInv.quantity + item.quantity })
        .eq("id", dstInv.id);
      if (dstErr) return { error: dstErr.message };
    } else {
      const { error: insertErr } = await supabase
        .from("inventory")
        .insert({ store_id: transfer.destination_store_id, device_id: item.device_id, quantity: item.quantity });
      if (insertErr) return { error: insertErr.message };
    }

    // Log stock movements for audit trail
    await supabase.from("stock_movements").insert([
      {
        store_id: transfer.source_store_id,
        device_id: item.device_id,
        movement_type: "transfer_out",
        quantity: -item.quantity,
        reference_type: "transfer",
        reference_id: transferId,
        performed_by: user.id,
      },
      {
        store_id: transfer.destination_store_id,
        device_id: item.device_id,
        movement_type: "transfer_in",
        quantity: item.quantity,
        reference_type: "transfer",
        reference_id: transferId,
        performed_by: user.id,
      },
    ]);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("transfers")
    .update({ status: "completed", transfer_date: now })
    .eq("id", transferId)
    .eq("status", "in_transit");

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}
