"use server";

// File purpose: Contains server actions for Admin device catalogue management.

// Server actions for device management — admin only
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, user: null, error: "Unauthorized" as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { supabase: null, user: null, error: "Admin only" as const };
  return { supabase, user, error: null };
}

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function createDevice(data: {
  sku: string;
  name: string;
  brand: string;
  category_id: string;
  unit_price: number;
  cost_price: number | null;
  low_stock_threshold: number;
}) {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const { error: dbErr } = await supabase.from("devices").insert({
    sku: data.sku.trim(),
    name: data.name.trim(),
    brand: data.brand.trim(),
    category_id: data.category_id || null,
    unit_price: data.unit_price,
    cost_price: data.cost_price,
    low_stock_threshold: data.low_stock_threshold,
    status: "active",
  });

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/devices");
  return { success: true };
}

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function updateDevice(
  id: string,
  data: {
    sku: string;
    name: string;
    brand: string;
    category_id: string;
    unit_price: number;
    cost_price: number | null;
    low_stock_threshold: number;
  }
) {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const { error: dbErr } = await supabase.from("devices").update({
    sku: data.sku.trim(),
    name: data.name.trim(),
    brand: data.brand.trim(),
    category_id: data.category_id || null,
    unit_price: data.unit_price,
    cost_price: data.cost_price,
    low_stock_threshold: data.low_stock_threshold,
  }).eq("id", id);

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/devices");
  return { success: true };
}

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function toggleDeviceStatus(id: string, currentStatus: string) {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const newStatus = currentStatus === "active" ? "discontinued" : "active";
  const { error: dbErr } = await supabase.from("devices").update({ status: newStatus }).eq("id", id);

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/devices");
  return { success: true };
}
