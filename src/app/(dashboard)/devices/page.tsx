import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/ui/PrintButton";
import { DeviceModal } from "@/features/devices/DeviceModal";
import { DevicesTable } from "@/features/devices/DevicesTable";
import { cn } from "@/utils/cn";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; status?: string; cat?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";
  const params = await searchParams;

  const [{ data: categories }, { data: brandRows }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("devices").select("brand").order("brand"),
  ]);

  const brands = [...new Set(brandRows?.map((b) => b.brand) ?? [])];

  let query = supabase
    .from("devices")
    .select("id, sku, name, brand, category_id, unit_price, cost_price, status, low_stock_threshold, categories(name)")
    .order("brand")
    .order("name");

  if (params.brand) query = query.eq("brand", params.brand);
  if (params.status) query = query.eq("status", params.status);
  if (params.cat) query = query.eq("category_id", params.cat);

  const { data: devices } = await query;
  const hasFilters = params.brand || params.status || params.cat;

  const categoryList = (categories ?? []).map(c => ({ id: c.id as string, name: c.name as string }));

  const deviceList = (devices ?? []).map((d) => ({
    id: d.id as string,
    sku: d.sku as string,
    name: d.name as string,
    brand: d.brand as string,
    category_id: d.category_id as string | null,
    category_name: (d.categories as unknown as { name: string } | null)?.name ?? null,
    unit_price: Number(d.unit_price),
    cost_price: d.cost_price ? Number(d.cost_price) : null,
    low_stock_threshold: d.low_stock_threshold as number,
    status: d.status as string,
  }));

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">{deviceList.length} devices</p>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
          {isAdmin && <DeviceModal categories={categoryList} />}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 no-print">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip href="/devices" active={!params.brand} label="All Brands" />
          {brands.map((b) => (
            <FilterChip
              key={b}
              href={buildUrl("/devices", { ...params, brand: b })}
              active={params.brand === b}
              label={b}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        <FilterChip href={buildUrl("/devices", { ...params, status: undefined })} active={!params.status} label="All Statuses" />
        <FilterChip href={buildUrl("/devices", { ...params, status: "active" })} active={params.status === "active"} label="Active" />
        <FilterChip href={buildUrl("/devices", { ...params, status: "discontinued" })} active={params.status === "discontinued"} label="Discontinued" />
        {hasFilters && (
          <a href="/devices" className="rounded-full border border-surface-200 px-3 py-1 text-xs font-medium text-surface-500 hover:bg-surface-50">
            Clear filters
          </a>
        )}
      </div>

      <DevicesTable devices={deviceList} categories={categoryList} isAdmin={isAdmin} />
    </div>
  );
}

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50"
      )}
    >
      {label}
    </a>
  );
}
