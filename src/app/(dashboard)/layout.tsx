// File purpose: Protects dashboard pages and passes authenticated user data into the shared dashboard shell.
// Shared layout for all dashboard pages
// Verifies auth, loads the user profile, counts active alerts for the bell badge,
// then renders the sidebar + topbar shell around the page content.
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { UserRole } from "@/types";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

// Supports the application by connecting UI, data, or shared business logic.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user, profile } = await getCurrentUserProfile();

  // Count active alerts for the bell badge
  let alertQuery = supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Store managers only see alerts for their store
  if (profile.role === "store_manager" && profile.store_id) {
    alertQuery = alertQuery.eq("store_id", profile.store_id);
  }

  const { count: alertCount } = await alertQuery;

  return (
    <DashboardShell
      userRole={profile.role as UserRole}
      userName={profile.full_name ?? "User"}
      alertCount={alertCount ?? 0}
      userId={user.id}
      storeId={(profile.store_id as string | null) ?? null}
    >
      {children}
    </DashboardShell>
  );
}
