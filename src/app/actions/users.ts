"use server";

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateUserStatus(userId: string, status: "active" | "inactive") {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Permission denied" };
  if (userId === session.user.id) return { error: "Cannot change your own status" };

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/users");
  return { success: true };
}

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Permission denied" };
  if (userId === session.user.id) return { error: "Cannot change your own role" };

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/users");
  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const { data: { session } } = await (await createServerSupabaseClient()).auth.getSession();
  if (!session) return { error: "Unauthorized" };

  const supabaseCheck = await createServerSupabaseClient();
  const { data: profile } = await supabaseCheck
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Permission denied" };

  const adminClient = await createServiceRoleClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) return { error: error.message };
  return { success: true };
}
