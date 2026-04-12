"use server";

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createUser(data: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  store_id: string | null;
}) {
  // Only admins can create users
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized" };

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", session.user.id).single();
  if (me?.role !== "admin") return { error: "Permission denied" };

  // Create auth user via admin API
  const adminClient = await createServiceRoleClient();
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.full_name, role: data.role },
  });

  if (authErr || !authData.user) {
    return { error: authErr?.message ?? "Failed to create auth user" };
  }

  // Upsert profile
  const { error: profileErr } = await adminClient.from("profiles").upsert({
    id: authData.user.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    store_id: data.store_id || null,
    status: "active",
  }, { onConflict: "id" });

  if (profileErr) {
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return { error: profileErr.message };
  }

  revalidatePath("/users");
  return { success: true };
}
