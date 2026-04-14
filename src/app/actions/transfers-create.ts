"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface TransferLineItem {
  device_id: string;
  quantity: number;
}

export async function createTransfer(data: {
  source_store_id: string;
  destination_store_id: string;
  notes: string;
  items: TransferLineItem[];
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!data.items.length) return { error: "Add at least one item" };
  if (data.source_store_id === data.destination_store_id)
    return { error: "Source and destination must be different" };

  // Insert transfer header
  const { data: transfer, error: transferErr } = await supabase
    .from("transfers")
    .insert({
      source_store_id: data.source_store_id,
      destination_store_id: data.destination_store_id,
      requested_by: user.id,
      status: "pending",
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (transferErr || !transfer)
    return { error: transferErr?.message ?? "Failed to create transfer" };

  // Insert line items
  const { error: itemsErr } = await supabase.from("transfer_items").insert(
    data.items.map((i) => ({
      transfer_id: transfer.id,
      device_id: i.device_id,
      quantity: i.quantity,
    }))
  );

  if (itemsErr) {
    await supabase.from("transfers").delete().eq("id", transfer.id);
    return { error: itemsErr.message };
  }

  revalidatePath("/transfers");
  revalidatePath("/dashboard");
  return { success: true, transferId: transfer.id };
}
