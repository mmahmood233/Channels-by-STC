import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/ui/ExportCsvButton";
import { PrintButton } from "@/components/ui/PrintButton";
import { StoreModal } from "@/features/stores/StoreModal";
import { StoresTable } from "@/features/stores/StoresTable";

export default async function StoresPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, code, address, city, region, phone, is_warehouse, status, created_at")
    .order("is_warehouse", { ascending: false })
    .order("name");

  const storeRows = (stores ?? []).map((store) => ({
    id: store.id as string,
    name: store.name as string,
    code: store.code as string,
    address: store.address as string | null,
    city: store.city as string | null,
    region: store.region as string | null,
    phone: store.phone as string | null,
    is_warehouse: store.is_warehouse as boolean,
    status: store.status as string,
    created_at: store.created_at as string,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">{storeRows.length} locations</p>
        <div className="flex flex-wrap justify-end gap-2 no-print">
          {storeRows.length > 0 && <PrintButton />}
          {storeRows.length > 0 && (
            <ExportCsvButton
              filename="locations-report.csv"
              headers={["Code", "Name", "Type", "Address", "City", "Region", "Phone", "Status"]}
              rows={storeRows.map((store) => [
                store.code,
                store.name,
                store.is_warehouse ? "Warehouse" : "Store",
                store.address ?? "",
                store.city ?? "",
                store.region ?? "",
                store.phone ?? "",
                store.status,
              ])}
            />
          )}
          <StoreModal />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Locations" value={String(storeRows.length)} />
        <SummaryCard label="Active" value={String(storeRows.filter((s) => s.status === "active").length)} />
        <SummaryCard label="Stores" value={String(storeRows.filter((s) => !s.is_warehouse).length)} />
        <SummaryCard label="Warehouses" value={String(storeRows.filter((s) => s.is_warehouse).length)} />
      </div>

      <StoresTable stores={storeRows} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white px-5 py-4 shadow-soft">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-surface-900">{value}</p>
    </div>
  );
}
