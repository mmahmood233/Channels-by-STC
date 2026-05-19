import { requireAdminProfile } from "@/lib/auth/current-user";
import { ExportCsvButton } from "@/components/ui/ExportCsvButton";
import { PrintButton } from "@/components/ui/PrintButton";
import { CategoryModal } from "@/features/categories/CategoryModal";
import { CategoriesTable } from "@/features/categories/CategoriesTable";

export default async function CategoriesPage() {
  const { supabase } = await requireAdminProfile();

  const [{ data: categories }, { data: devices }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, description, created_at")
      .order("name"),
    supabase
      .from("devices")
      .select("category_id"),
  ]);

  const deviceCounts = new Map<string, number>();
  for (const device of devices ?? []) {
    const categoryId = device.category_id as string | null;
    if (categoryId) deviceCounts.set(categoryId, (deviceCounts.get(categoryId) ?? 0) + 1);
  }

  const categoryRows = (categories ?? []).map((category) => ({
    id: category.id as string,
    name: category.name as string,
    description: category.description as string | null,
    device_count: deviceCounts.get(category.id as string) ?? 0,
    created_at: category.created_at as string,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">{categoryRows.length} categories</p>
        <div className="flex flex-wrap justify-end gap-2 no-print">
          {categoryRows.length > 0 && <PrintButton />}
          {categoryRows.length > 0 && (
            <ExportCsvButton
              filename="categories-report.csv"
              headers={["Name", "Description", "Devices"]}
              rows={categoryRows.map((category) => [
                category.name,
                category.description ?? "",
                category.device_count,
              ])}
            />
          )}
          <CategoryModal />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Categories" value={String(categoryRows.length)} />
        <SummaryCard label="Assigned Devices" value={String(categoryRows.reduce((sum, c) => sum + c.device_count, 0))} />
        <SummaryCard label="Unused Categories" value={String(categoryRows.filter((c) => c.device_count === 0).length)} />
      </div>

      <CategoriesTable categories={categoryRows} />
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
