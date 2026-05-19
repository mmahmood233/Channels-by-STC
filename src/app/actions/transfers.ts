"use server";

// File purpose: Contains server actions for approving, rejecting, moving, and completing transfers.

// Server actions for transfer status management
// Transfer lifecycle: pending → approved → in_transit → completed (or rejected/cancelled)
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Approve a pending transfer request.
// Only Admin and Warehouse Manager users can approve transfers.
// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function approveTransfer(transferId: string) {
  // Read the logged-in user from Supabase Auth.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Load the user's role from profiles.
  // Auth confirms identity; profiles confirms business permission.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "warehouse_manager")) {
    return { error: "Permission denied" };
  }

  // Update only if the transfer is still pending.
  // This prevents approving an already changed transfer.
  const { error } = await supabase
    .from("transfers")
    .update({ status: "approved", approved_by: user.id })
    .eq("id", transferId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  // Refresh the transfers page so the new status appears.
  revalidatePath("/transfers");
  return { success: true };
}

// Reject a transfer request.
// Rejected transfers do not change inventory quantities.
// Runs on the server to validate the request, update Supabase, and refresh affected pages.
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

  // A transfer can be rejected while pending or approved.
  const { error } = await supabase
    .from("transfers")
    .update({ status: "rejected" })
    .eq("id", transferId)
    .in("status", ["pending", "approved"]);

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}

// Move an approved transfer into the in-transit stage.
// Inventory is still not changed at this stage.
// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function markInTransit(transferId: string) {
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

  // Status must be approved before it can become in_transit.
  const { error } = await supabase
    .from("transfers")
    .update({ status: "in_transit" })
    .eq("id", transferId)
    .eq("status", "approved");

  if (error) return { error: error.message };
  revalidatePath("/transfers");
  return { success: true };
}

// Complete a transfer.
// This is the stage where inventory actually changes.
// Runs on the server to validate the request, update Supabase, and refresh affected pages.
export async function completeTransfer(transferId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Database function handles the atomic stock movement:
  // source store decreases, destination store increases, stock logs are inserted.
  const { error } = await supabase.rpc("complete_transfer_atomic", {
    p_transfer_id: transferId,
  });

  if (error) return { error: error.message };
  // Refresh all pages that depend on transfer or inventory data.
  revalidatePath("/transfers");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}
