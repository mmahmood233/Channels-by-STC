"use server";

// File purpose: Contains server actions for store and warehouse location management.

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Unauthorized" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { supabase: null, error: "Admin only" as const };
  return { supabase, error: null };
}

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function createStore(data: {
  name: string;
  code: string;
  address: string;
  city: string;
  region: string;
  phone: string;
  is_warehouse: boolean;
}) {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const { error: dbErr } = await supabase.from("stores").insert({
    name: data.name.trim(),
    code: data.code.trim().toUpperCase(),
    address: data.address.trim() || null,
    city: data.city.trim() || null,
    region: data.region.trim() || null,
    phone: data.phone.trim() || null,
    is_warehouse: data.is_warehouse,
    status: "active",
  });

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/stores");
  revalidatePath("/inventory");
  revalidatePath("/transfers");
  return { success: true };
}

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function updateStore(
  id: string,
  data: {
    name: string;
    code: string;
    address: string;
    city: string;
    region: string;
    phone: string;
    is_warehouse: boolean;
  }
) {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const { error: dbErr } = await supabase
    .from("stores")
    .update({
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      address: data.address.trim() || null,
      city: data.city.trim() || null,
      region: data.region.trim() || null,
      phone: data.phone.trim() || null,
      is_warehouse: data.is_warehouse,
    })
    .eq("id", id);

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/stores");
  revalidatePath("/inventory");
  revalidatePath("/transfers");
  return { success: true };
}

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function updateStoreStatus(id: string, status: "active" | "inactive") {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const { error: dbErr } = await supabase
    .from("stores")
    .update({ status })
    .eq("id", id);

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/stores");
  revalidatePath("/inventory");
  revalidatePath("/transfers");
  return { success: true };
}
