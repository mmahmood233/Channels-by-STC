"use server";

// File purpose: Contains server actions for category management.

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
export async function createCategory(data: { name: string; description: string }) {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const { error: dbErr } = await supabase.from("categories").insert({
    name: data.name.trim(),
    description: data.description.trim() || null,
  });

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/categories");
  revalidatePath("/devices");
  return { success: true };
}

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function updateCategory(id: string, data: { name: string; description: string }) {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const { error: dbErr } = await supabase
    .from("categories")
    .update({
      name: data.name.trim(),
      description: data.description.trim() || null,
    })
    .eq("id", id);

  if (dbErr) return { error: dbErr.message };
  revalidatePath("/categories");
  revalidatePath("/devices");
  return { success: true };
}

// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function deleteCategory(id: string) {
  const { supabase, error } = await requireAdmin();
  if (error || !supabase) return { error };

  const { error: dbErr } = await supabase.from("categories").delete().eq("id", id);
  if (dbErr) return { error: dbErr.message };
  revalidatePath("/categories");
  revalidatePath("/devices");
  return { success: true };
}
