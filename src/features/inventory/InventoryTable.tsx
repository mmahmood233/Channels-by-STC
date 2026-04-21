"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Package } from "lucide-react";
import { cn } from "@/utils/cn";

interface InventoryRow {
  inventory_id: string;
  store_id: string;
  store_name: string;
  is_warehouse: boolean;
  device_id: string;
  device_name: string;
  sku: string;
  brand: string;
  category_name: string | null;
  quantity: number;
  low_stock_threshold: number;
  stock_status: string;
}

interface Props {
  rows: InventoryRow[];
  isAdmin: boolean;
  isWarehouse: boolean;
}

export function InventoryTable({ rows, isAdmin, isWarehouse }: Props) {
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? rows.filter((r) => {
        const term = q.toLowerCase();
        return (
          r.device_name.toLowerCase().includes(term) ||
          r.sku.toLowerCase().includes(term) ||
          r.brand.toLowerCase().includes(term) ||
          r.store_name.toLowerCase().includes(term)
        );
      })
    : rows;

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          {q && ` for "${q}"`}
        </p>
        <div className="relative flex items-center no-print">
          <Search className="absolute left-3 h-4 w-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search inventory…"
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
                  {(isAdmin || isWarehouse) && <Th>Store</Th>}
                  <Th>SKU</Th>
                  <Th>Device</Th>
                  <Th>Brand</Th>
                  <Th>Category</Th>
                  <Th>Qty</Th>
                  <Th>Threshold</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {filtered.map((row) => (
                  <tr
                    key={row.inventory_id}
                    className={cn(
                      "transition-colors hover:bg-surface-50/60",
                      row.stock_status === "out_of_stock" && "bg-red-50/30",
                      row.stock_status === "low_stock" && "bg-amber-50/20"
                    )}
                  >
                    {(isAdmin || isWarehouse) && (
                      <Td>
                        <div className="flex items-center gap-2">
                          <span>{row.store_name}</span>
                          {row.is_warehouse && <Badge variant="purple">WH</Badge>}
                        </div>
                      </Td>
                    )}
                    <Td>
                      <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs font-mono">
                        {row.sku}
                      </code>
                    </Td>
                    <Td className="font-medium text-surface-900">{row.device_name}</Td>
                    <Td>{row.brand}</Td>
                    <Td className="text-surface-500">{row.category_name}</Td>
                    <Td>
                      <span className={cn(
                        "font-bold",
                        row.stock_status === "out_of_stock" ? "text-red-600"
                          : row.stock_status === "low_stock" ? "text-amber-600"
                          : "text-surface-900"
                      )}>
                        {row.quantity}
                      </span>
                    </Td>
                    <Td className="text-surface-500">{row.low_stock_threshold}</Td>
                    <Td>
                      {row.stock_status === "out_of_stock" ? <Badge variant="danger">Out of Stock</Badge>
                        : row.stock_status === "low_stock" ? <Badge variant="warning">Low Stock</Badge>
                        : <Badge variant="success">In Stock</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title={q ? `No results for "${q}"` : "No inventory records"}
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
