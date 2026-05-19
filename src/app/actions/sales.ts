"use server";

// File purpose: Contains server actions for creating and voiding sales through safe database functions.

// Server actions for sales: create a new sale and void an existing one
// createSale: checks stock, inserts sale + line items, decrements inventory
// voidSale: admin only — reverses inventory and marks sale as [VOIDED]
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface SaleLineItem {
  device_id: string;
  quantity: number;
  unit_price: number;
}

// Called by the Record Sale modal.
// It does not update tables directly in TypeScript.
// Instead, it calls the PostgreSQL function create_sale_atomic.
// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function createSale(data: {
  store_id: string;
  sale_date: string;
  notes: string;
  items: SaleLineItem[];
}) {
  // Create a server-side Supabase client so the action can read the session.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // A sale must have at least one item.
  if (!data.items.length) return { error: "Add at least one item" };

  // Database function handles the full sale workflow:
  // create sale, create sale items, reduce inventory, and log stock movement.
  const { data: saleId, error } = await supabase.rpc("create_sale_atomic", {
    p_store_id: data.store_id,
    p_sale_date: data.sale_date,
    p_notes: data.notes,
    p_items: data.items,
  });

  if (error) return { error: error.message };

  // Refresh pages that depend on sales or inventory data.
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, saleId };
}

// Called when an Admin voids a sale.
// This reverses the inventory effect while keeping the sale traceable.
// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function voidSale(saleId: string, reason: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Only Admin users can void sales.
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Admin only" };

  // Database function restores stock and marks the sale as voided.
  const { error } = await supabase.rpc("void_sale_atomic", {
    p_sale_id: saleId,
    p_reason: reason,
  });

  if (error) return { error: error.message };

  // Refresh pages that show sale and stock information.
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}
