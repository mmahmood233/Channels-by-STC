"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function acknowledgeAlert(alertId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("alerts")
    .update({ status: "acknowledged" })
    .eq("id", alertId)
    .eq("status", "active");

  if (error) return { error: error.message };
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function resolveAlert(alertId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized" };

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("alerts")
    .update({ status: "resolved", resolved_at: now, resolved_by: session.user.id })
    .eq("id", alertId)
    .in("status", ["active", "acknowledged"]);

  if (error) return { error: error.message };
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function dismissAlert(alertId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("alerts")
    .update({ status: "dismissed" })
    .eq("id", alertId);

  if (error) return { error: error.message };
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return { success: true };
}
