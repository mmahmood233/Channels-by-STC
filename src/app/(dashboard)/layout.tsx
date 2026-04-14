import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { UserRole } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email, store_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Count active alerts for the bell badge
  let alertQuery = supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Store managers only see alerts for their store
  if (profile.role === "store_manager") {
    const { data: storeProfile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.id)
      .single();
    if (storeProfile?.store_id) {
      alertQuery = alertQuery.eq("store_id", storeProfile.store_id);
    }
  }

  const { count: alertCount } = await alertQuery;

  return (
    <DashboardShell
      userRole={profile.role as UserRole}
      userName={profile.full_name ?? "User"}
      userEmail={profile.email ?? user.email ?? ""}
      alertCount={alertCount ?? 0}
      userId={user.id}
      storeId={(profile.store_id as string | null) ?? null}
    >
      {children}
    </DashboardShell>
  );
}
