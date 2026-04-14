import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react";
import { formatDateTime } from "@/utils/format";
import { ROLE_LABELS } from "@/constants";
import { UserRowActions } from "@/features/users/UserRowActions";
import { CreateUserModal } from "@/features/users/CreateUserModal";
import { cn } from "@/utils/cn";
import type { UserRole } from "@/types";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Admin-only page
  if (me?.role !== "admin") redirect("/dashboard");

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

  const roleVariant: Record<UserRole, "purple" | "info" | "success"> = {
    admin: "purple",
    store_manager: "info",
    warehouse_manager: "success",
  };

  return (
    <div className="space-y-6">
      {/* Add user button */}
      <div className="flex justify-end">
        <CreateUserModal stores={stores} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Users" value={String(users?.length ?? 0)} />
        <SummaryCard label="Active" value={String(users?.filter((u) => u.status === "active").length ?? 0)} />
        <SummaryCard label="Admins" value={String(users?.filter((u) => u.role === "admin").length ?? 0)} />
        <SummaryCard label="Store Managers" value={String(users?.filter((u) => u.role === "store_manager").length ?? 0)} />
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

      {/* Table */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {users && users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Store</Th>
                  <Th>Status</Th>
                  <Th>Last Sign In</Th>
                  <Th>Joined</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {users.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-surface-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                          {user.full_name?.charAt(0).toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-surface-900">{user.full_name}</p>
                          <p className="text-xs text-surface-400">{user.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={roleVariant[user.role as UserRole] ?? "default"}>
                        {ROLE_LABELS[user.role as UserRole] ?? user.role}
                      </Badge>
                    </Td>
                    <Td>
                      {(user.stores as unknown as { name: string } | null)?.name ?? (
                        <span className="text-surface-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge variant={user.status === "active" ? "success" : "default"}>
                        {user.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-surface-400">
                      {user.last_sign_in_at
                        ? formatDateTime(user.last_sign_in_at)
                        : "Never"}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-surface-400">
                      {formatDateTime(user.created_at)}
                    </Td>
                    <Td>
                      <UserRowActions
                        userId={user.id}
                        currentStatus={user.status}
                        currentUserId={user.id}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Users will appear here once registered"
          />
        )}
      </div>
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-surface-700", className)}>{children}</td>;
}
