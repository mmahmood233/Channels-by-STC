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

  const { data: transferId, error } = await supabase.rpc("create_transfer_atomic", {
    p_source_store_id: data.source_store_id,
    p_destination_store_id: data.destination_store_id,
    p_notes: data.notes,
    p_items: data.items,
  });

  if (error) return { error: error.message };

  revalidatePath("/transfers");
  revalidatePath("/dashboard");
  return { success: true, transferId };
}
