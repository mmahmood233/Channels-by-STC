import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export const getCurrentUserProfile = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email, store_id, stores(name)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return {
    supabase,
    user,
    profile: {
      ...profile,
      role: profile.role as UserRole,
      store_id: (profile.store_id as string | null) ?? null,
      store_name: (profile.stores as unknown as { name: string } | null)?.name ?? null,
    },
  };
});

export async function requireAdminProfile() {
  const context = await getCurrentUserProfile();
  if (context.profile.role !== "admin") redirect("/dashboard");
  return context;
}

export async function requireWarehouseOrAdminProfile() {
  const context = await getCurrentUserProfile();
  if (context.profile.role !== "admin" && context.profile.role !== "warehouse_manager") {
    redirect("/dashboard");
  }
  return context;
}
