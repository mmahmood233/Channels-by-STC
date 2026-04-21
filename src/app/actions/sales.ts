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

  // Check sufficient stock for each item before creating sale
  for (const item of data.items) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("store_id", data.store_id)
      .eq("device_id", item.device_id)
      .single();
    const available = inv?.quantity ?? 0;
    if (available < item.quantity) {
      return { error: `Insufficient stock — only ${available} unit(s) available for one of the items` };
    }
  }

  const total = data.items.reduce(
    (sum, i) => sum + i.quantity * i.unit_price,
    0
  );

  // Insert sale header
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .insert({
      store_id: data.store_id,
      sold_by: user.id,
      sale_date: data.sale_date,
      total_amount: total,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (saleErr || !sale) return { error: saleErr?.message ?? "Failed to create sale" };

  // Insert line items
  const { error: itemsErr } = await supabase.from("sale_items").insert(
    data.items.map((i) => ({
      sale_id: sale.id,
      device_id: i.device_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      line_total: i.quantity * i.unit_price,
    }))
  );

  if (itemsErr) {
    // Roll back the sale header
    await supabase.from("sales").delete().eq("id", sale.id);
    return { error: itemsErr.message };
  }

  // Update inventory: decrement quantity for each item
  for (const item of data.items) {
    // Get current qty
    const { data: inv } = await supabase
      .from("inventory")
      .select("id, quantity")
      .eq("store_id", data.store_id)
      .eq("device_id", item.device_id)
      .single();

    if (inv) {
      await supabase
        .from("inventory")
        .update({ quantity: Math.max(0, inv.quantity - item.quantity) })
        .eq("id", inv.id);
    }

    // Append stock movement
    await supabase.from("stock_movements").insert({
      store_id: data.store_id,
      device_id: item.device_id,
      movement_type: "sale",
      quantity: -item.quantity,
      reference_type: "sale",
      reference_id: sale.id,
      performed_by: user.id,
    });
  }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, saleId: sale.id };
}

export async function voidSale(saleId: string, reason: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Admin only" };

  // Fetch sale + items
  const { data: sale } = await supabase
    .from("sales")
    .select("id, store_id, notes, sale_items(device_id, quantity)")
    .eq("id", saleId)
    .single();

  if (!sale) return { error: "Sale not found" };
  if ((sale.notes as string | null)?.startsWith("[VOIDED]")) return { error: "Sale already voided" };

  const items = (sale.sale_items as { device_id: string; quantity: number }[]) ?? [];

  // Reverse inventory + record stock movements
  for (const item of items) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("id, quantity")
      .eq("store_id", sale.store_id)
      .eq("device_id", item.device_id)
      .single();

    if (inv) {
      await supabase
        .from("inventory")
        .update({ quantity: inv.quantity + item.quantity })
        .eq("id", inv.id);
    }

    await supabase.from("stock_movements").insert({
      store_id: sale.store_id,
      device_id: item.device_id,
      movement_type: "return",
      quantity: item.quantity,
      reference_type: "sale_void",
      reference_id: saleId,
      notes: `Voided sale — ${reason}`,
      performed_by: user.id,
    });
  }

  // Mark sale as voided in notes
  await supabase.from("sales").update({
    notes: `[VOIDED] ${reason}`,
  }).eq("id", saleId);

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}
