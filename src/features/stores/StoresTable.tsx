"use client";

import { useState, useTransition } from "react";
import { Building2, Loader2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StoreModal } from "@/features/stores/StoreModal";
import { updateStoreStatus } from "@/app/actions/stores";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/utils/cn";

interface StoreRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  is_warehouse: boolean;
  status: string;
  created_at: string;
}

export function StoresTable({ stores }: { stores: StoreRow[] }) {
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error } = useToast();

  const filtered = q.trim()
    ? stores.filter((store) => {
        const term = q.toLowerCase();
        return [store.name, store.code, store.city, store.region].some((value) =>
          value?.toLowerCase().includes(term)
        );
      })
    : stores;

  function toggleStatus(store: StoreRow) {
    setPendingId(store.id);
    startTransition(async () => {
      const next = store.status === "active" ? "inactive" : "active";
      const result = await updateStoreStatus(store.id, next);
      setPendingId(null);
      if (result.error) error(result.error);
      else success(next === "active" ? "Location activated" : "Location deactivated");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
        <div className="relative flex items-center no-print">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-surface-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search locations..."
            className="h-9 w-60 rounded-xl border border-surface-200 bg-white pl-9 pr-8 text-sm text-surface-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2.5 text-surface-400 hover:text-surface-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-left">
                  <Th>Code</Th>
                  <Th>Location</Th>
                  <Th>Type</Th>
                  <Th>City</Th>
                  <Th>Region</Th>
                  <Th>Phone</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {filtered.map((store) => (
                  <tr key={store.id} className="transition-colors hover:bg-surface-50/60">
                    <Td><code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-700">{store.code}</code></Td>
                    <Td>
                      <p className="font-medium text-surface-900">{store.name}</p>
                      <p className="max-w-xs truncate text-xs text-surface-400">{store.address ?? "No address"}</p>
                    </Td>
                    <Td>
                      <Badge variant={store.is_warehouse ? "purple" : "info"}>
                        {store.is_warehouse ? "Warehouse" : "Store"}
                      </Badge>
                    </Td>
                    <Td>{store.city ?? "—"}</Td>
                    <Td>{store.region ?? "—"}</Td>
                    <Td>{store.phone ?? "—"}</Td>
                    <Td>
                      <Badge variant={store.status === "active" ? "success" : "default"}>
                        {store.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5 no-print">
                        <StoreModal store={store} />
                        <button
                          onClick={() => toggleStatus(store)}
                          disabled={isPending && pendingId === store.id}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                            store.status === "active"
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-green-50 text-green-600 hover:bg-green-100"
                          )}
                        >
                          {isPending && pendingId === store.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : store.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Building2} title="No locations found" description="Locations will appear here once added" />
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
