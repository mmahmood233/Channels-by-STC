"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DeviceModal } from "@/features/devices/DeviceModal";
import { DeviceStatusToggle } from "@/features/devices/DeviceStatusToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { Smartphone } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";

interface Category { id: string; name: string; }
interface Device {
  id: string; sku: string; name: string; brand: string;
  category_id: string | null; category_name: string | null;
  unit_price: number; cost_price: number | null;
  low_stock_threshold: number; status: string;
}

interface Props {
  devices: Device[];
  categories: Category[];
  isAdmin: boolean;
}

export function DevicesTable({ devices, categories, isAdmin }: Props) {
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? devices.filter((d) => {
        const term = q.toLowerCase();
        return (
          d.name.toLowerCase().includes(term) ||
          d.sku.toLowerCase().includes(term) ||
          d.brand.toLowerCase().includes(term)
        );
      })
    : devices;

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          {q && ` for "${q}"`}
        </p>
        <div className="relative flex items-center no-print">
          <Search className="absolute left-3 h-4 w-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search devices…"
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
                  <Th>SKU</Th>
                  <Th>Device</Th>
                  <Th>Brand</Th>
                  <Th>Category</Th>
                  <Th>Selling Price</Th>
                  <Th>Cost Price</Th>
                  <Th>Min Stock</Th>
                  <Th>Status</Th>
                  {isAdmin && <Th>Actions</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {filtered.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-surface-50/60">
                    <Td>
                      <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-mono text-surface-700">
                        {d.sku}
                      </code>
                    </Td>
                    <Td className="font-medium text-surface-900">{d.name}</Td>
                    <Td>{d.brand}</Td>
                    <Td>{d.category_name ?? "—"}</Td>
                    <Td className="font-semibold">{formatCurrency(d.unit_price)}</Td>
                    <Td className="text-surface-500">{d.cost_price ? formatCurrency(d.cost_price) : "—"}</Td>
                    <Td>{d.low_stock_threshold}</Td>
                    <Td>
                      <Badge variant={d.status === "active" ? "success" : "default"}>
                        {d.status === "active" ? "Active" : "Discontinued"}
                      </Badge>
                    </Td>
                    {isAdmin && (
                      <Td>
                        <div className="flex items-center gap-1.5 no-print">
                          <DeviceModal categories={categories} device={d} />
                          <DeviceStatusToggle deviceId={d.id} currentStatus={d.status} />
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Smartphone}
            title={q ? `No devices match "${q}"` : "No devices found"}
            description={q ? "Try a different search term" : "Try adjusting your filters"}
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
