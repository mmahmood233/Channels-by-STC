// File purpose: Centralizes current-user loading and role checks for protected pages.
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

// This helper is used by protected dashboard pages.
// It loads the logged-in user once per server render and shares the result.
// This avoids repeating the same "get user + get profile" code in every page.
export const getCurrentUserProfile = cache(async () => {
  // Server-side Supabase client reads the user's auth cookies safely.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If there is no logged-in user, the dashboard should not open.
  if (!user) redirect("/login");

  // The profile table stores the business role and assigned store.
  // Auth only knows the account. The app needs the profile to know permissions.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email, store_id, stores(name)")
    .eq("id", user.id)
    .single();

  // If the auth user exists but no profile exists, the app cannot know the role.
  // Redirecting is safer than showing protected pages without permissions.
  if (!profile) redirect("/login");

  // Return one shared object used by pages, layouts, and role checks.
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

// Use this when a page is only for Admin users.
// Supports the application by connecting UI, data, or shared business logic.
export async function requireAdminProfile() {
  const context = await getCurrentUserProfile();
  if (context.profile.role !== "admin") redirect("/dashboard");
  return context;
}

// Use this when a page/action is allowed for Admin and Warehouse Manager only.
// Supports the application by connecting UI, data, or shared business logic.
export async function requireWarehouseOrAdminProfile() {
  const context = await getCurrentUserProfile();
  if (context.profile.role !== "admin" && context.profile.role !== "warehouse_manager") {
    redirect("/dashboard");
  }
  return context;
}
