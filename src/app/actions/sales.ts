"use server";

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

export async function createSale(data: {
  store_id: string;
  sale_date: string;
  notes: string;
  items: SaleLineItem[];
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (!data.items.length) return { error: "Add at least one item" };

  const { data: saleId, error } = await supabase.rpc("create_sale_atomic", {
    p_store_id: data.store_id,
    p_sale_date: data.sale_date,
    p_notes: data.notes,
    p_items: data.items,
  });

  if (error) return { error: error.message };

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, saleId };
}

export async function voidSale(saleId: string, reason: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Admin only" };

  const { error } = await supabase.rpc("void_sale_atomic", {
    p_sale_id: saleId,
    p_reason: reason,
  });

  if (error) return { error: error.message };

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}
