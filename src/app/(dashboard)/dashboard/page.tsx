import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/features/dashboard/AdminDashboard";
import { StoreManagerDashboard } from "@/features/dashboard/StoreManagerDashboard";
import { WarehouseManagerDashboard } from "@/features/dashboard/WarehouseManagerDashboard";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id, full_name, stores(name)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as string;
  const userId = user.id;
  const userName = (profile.full_name as string) ?? "User";

  if (role === "store_manager") {
    const storeId = profile.store_id as string | null;
    if (!storeId) redirect("/login");
    const storeName = (profile.stores as unknown as { name: string } | null)?.name ?? "Your Store";
    return (
      <StoreManagerDashboard
        userId={userId}
        storeId={storeId}
        storeName={storeName}
        userName={userName}
      />
    );
  }

  if (role === "warehouse_manager") {
    return <WarehouseManagerDashboard userId={userId} userName={userName} />;
  }

  return <AdminDashboard userId={userId} userName={userName} />;
}
