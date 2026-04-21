"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserRowActions } from "@/features/users/UserRowActions";
import { Users } from "lucide-react";
import { formatDateTime } from "@/utils/format";
import { ROLE_LABELS } from "@/constants";
import { cn } from "@/utils/cn";
import type { UserRole } from "@/types";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  store_name: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

interface Props {
  users: UserRow[];
  currentUserId: string;
}

const roleVariant: Record<UserRole, "purple" | "info" | "success"> = {
  admin: "purple",
  store_manager: "info",
  warehouse_manager: "success",
};

export function UsersTable({ users, currentUserId }: Props) {
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? users.filter((u) => {
        const term = q.toLowerCase();
        return (
          u.full_name?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term)
        );
      })
    : users;

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          {q && ` matching "${q}"`}
        </p>
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users…"
            className="h-9 w-56 rounded-xl border border-surface-200 bg-white pl-9 pr-8 text-sm text-surface-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2.5 text-surface-400 hover:text-surface-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {filtered.length > 0 ? (
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
                {filtered.map((user) => (
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
                    <Td>{user.store_name ?? <span className="text-surface-400">—</span>}</Td>
                    <Td>
                      <Badge variant={user.status === "active" ? "success" : "default"}>
                        {user.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-surface-400">
                      {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Never"}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-surface-400">
                      {formatDateTime(user.created_at)}
                    </Td>
                    <Td>
                      <UserRowActions userId={user.id} currentStatus={user.status} currentUserId={currentUserId} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title={q ? `No users match "${q}"` : "No users found"}
            description={q ? "Try a different search term" : "Users will appear here once registered"}
          />
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-surface-400">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-surface-700", className)}>{children}</td>;
}
