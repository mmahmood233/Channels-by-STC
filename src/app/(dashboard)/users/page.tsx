// File purpose: Loads data for a protected dashboard module and renders its page UI.
import { requireAdminProfile } from "@/lib/auth/current-user";
import { CreateUserModal } from "@/features/users/CreateUserModal";
import { UsersTable } from "@/features/users/UsersTable";
import { ExportCsvButton } from "@/components/ui/ExportCsvButton";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";

// Loads data for this dashboard page and renders the matching feature UI.
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string }>;
}) {
  const { supabase, user } = await requireAdminProfile();

  const params = await searchParams;

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, role, status, store_id, last_sign_in_at, created_at, stores(name)")
    .order("created_at", { ascending: false });

  if (params.role) query = query.eq("role", params.role);
  if (params.status) query = query.eq("status", params.status);

  const { data: users } = await query;

  const { data: storesRaw } = await supabase
    .from("stores").select("id, name, is_warehouse").eq("status", "active").order("name");
  const stores = (storesRaw ?? []).map((s) => ({
    id: s.id as string, name: s.name as string, is_warehouse: s.is_warehouse as boolean,
  }));

  const userList = (users ?? []).map((u) => ({
    id: u.id as string,
    email: u.email as string,
    full_name: u.full_name as string,
    role: u.role as string,
    status: u.status as string,
    store_name: (u.stores as unknown as { name: string } | null)?.name ?? null,
    last_sign_in_at: u.last_sign_in_at as string | null,
    created_at: u.created_at as string,
  }));

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">{userList.length} users</p>
        <div className="flex items-center gap-2">
          {userList.length > 0 && <PrintButton />}
          {userList.length > 0 && (
            <ExportCsvButton
              filename="users-report.csv"
              headers={["Email", "Name", "Role", "Store", "Status", "Last Sign In", "Created"]}
              rows={userList.map((profile) => [
                profile.email,
                profile.full_name,
                profile.role,
                profile.store_name ?? "",
                profile.status,
                profile.last_sign_in_at ? formatDateTime(profile.last_sign_in_at) : "",
                formatDateTime(profile.created_at),
              ])}
            />
          )}
          <CreateUserModal stores={stores} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Users" value={String(userList.length)} />
        <SummaryCard label="Active" value={String(userList.filter((u) => u.status === "active").length)} />
        <SummaryCard label="Admins" value={String(userList.filter((u) => u.role === "admin").length)} />
        <SummaryCard label="Store Managers" value={String(userList.filter((u) => u.role === "store_manager").length)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip href="/users" active={!params.role && !params.status} label="All" />
        <FilterChip href={buildUrl("/users", { ...params, role: "admin" })} active={params.role === "admin"} label="Admin" />
        <FilterChip href={buildUrl("/users", { ...params, role: "store_manager" })} active={params.role === "store_manager"} label="Store Managers" />
        <FilterChip href={buildUrl("/users", { ...params, role: "warehouse_manager" })} active={params.role === "warehouse_manager"} label="Warehouse Managers" />
        <span className="w-px bg-surface-200 mx-1 self-stretch" />
        <FilterChip href={buildUrl("/users", { ...params, status: "active" })} active={params.status === "active"} label="Active" />
        <FilterChip href={buildUrl("/users", { ...params, status: "inactive" })} active={params.status === "inactive"} label="Inactive" />
      </div>

      <UsersTable users={userList} currentUserId={user.id} />
    </div>
  );
}

// Supports the application by connecting UI, data, or shared business logic.
function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white px-5 py-4 shadow-soft">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-surface-900">{value}</p>
    </div>
  );
}

// Supports the application by connecting UI, data, or shared business logic.
function buildUrl(base: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

// Supports the application by connecting UI, data, or shared business logic.
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
