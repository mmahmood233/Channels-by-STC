"use server";

// Server actions for transfer status management
// Transfer lifecycle: pending → approved → in_transit → completed (or cancelled at any step)
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveTransfer(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "warehouse_manager")) {
    return { error: "Permission denied" };
  }

  const { error } = await supabase
    .from("transfers")
    .update({ status: "approved", approved_by: user.id })
    .eq("id", transferId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}

export async function rejectTransfer(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "warehouse_manager")) {
    return { error: "Permission denied" };
  }

  const { error } = await supabase
    .from("transfers")
    .update({ status: "cancelled" })
    .eq("id", transferId)
    .in("status", ["pending", "approved"]);

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}

export async function markInTransit(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("transfers")
    .update({ status: "in_transit" })
    .eq("id", transferId)
    .eq("status", "approved");

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}

export async function completeTransfer(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("transfers")
    .update({ status: "completed", transfer_date: now })
    .eq("id", transferId)
    .eq("status", "in_transit");

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}
