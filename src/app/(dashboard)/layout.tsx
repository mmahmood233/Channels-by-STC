import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { UserRole } from "@/types";

// Map route segments to human-readable titles
function getPageTitle(pathname?: string): string {
  if (!pathname) return "Dashboard";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/devices")) return "Devices";
  if (pathname.startsWith("/inventory")) return "Inventory";
  if (pathname.startsWith("/sales")) return "Sales";
  if (pathname.startsWith("/transfers")) return "Transfers";
  if (pathname.startsWith("/alerts")) return "Alerts";
  if (pathname.startsWith("/forecasts")) return "Forecasts";
  if (pathname.startsWith("/chatbot")) return "AI Chatbot";
  if (pathname.startsWith("/users")) return "Users";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  // Get authenticated session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("id", session.user.id)
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
      .eq("id", session.user.id)
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
      userEmail={profile.email ?? session.user.email ?? ""}
      pageTitle="Dashboard"
      alertCount={alertCount ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
