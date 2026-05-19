"use server";

// File purpose: Contains the server action that creates transfer requests and transfer items.

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface TransferLineItem {
  device_id: string;
  quantity: number;
}

// Called by the Request Transfer modal.
// It creates a transfer request and its transfer items.
// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function createTransfer(data: {
  source_store_id: string;
  destination_store_id: string;
  notes: string;
  items: TransferLineItem[];
}) {
  // Server-side client gives this action access to the logged-in user session.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Basic validation before calling the database function.
  if (!data.items.length) return { error: "Add at least one item" };
  if (data.source_store_id === data.destination_store_id)
    return { error: "Source and destination must be different" };

  // Database function inserts the transfer and transfer_items together.
  // It also checks role/store rules inside the database.
  const { data: transferId, error } = await supabase.rpc("create_transfer_atomic", {
    p_source_store_id: data.source_store_id,
    p_destination_store_id: data.destination_store_id,
    p_notes: data.notes,
    p_items: data.items,
  });

  if (error) return { error: error.message };

  // Refresh pages that show transfer activity.
  revalidatePath("/transfers");
  revalidatePath("/dashboard");
  return { success: true, transferId };
}
