"use server";

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
