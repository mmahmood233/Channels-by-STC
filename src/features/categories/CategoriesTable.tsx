"use client";

import { useState } from "react";
import { Search, Tags, X } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryModal } from "@/features/categories/CategoryModal";
import { DeleteCategoryButton } from "@/features/categories/DeleteCategoryButton";
import { cn } from "@/utils/cn";

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  device_count: number;
  created_at: string;
}

export function CategoriesTable({ categories }: { categories: CategoryRow[] }) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? categories.filter((category) => {
        const term = q.toLowerCase();
        return category.name.toLowerCase().includes(term) ||
          (category.description ?? "").toLowerCase().includes(term);
      })
    : categories;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-surface-500">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
        <div className="relative flex items-center no-print">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-surface-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search categories..."
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
                  <Th>Name</Th>
                  <Th>Description</Th>
                  <Th>Devices</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {filtered.map((category) => (
                  <tr key={category.id} className="transition-colors hover:bg-surface-50/60">
                    <Td className="font-medium text-surface-900">{category.name}</Td>
                    <Td>{category.description ?? "—"}</Td>
                    <Td>{category.device_count}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5 no-print">
                        <CategoryModal category={category} />
                        <DeleteCategoryButton categoryId={category.id} deviceCount={category.device_count} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Tags} title="No categories found" description="Categories will appear here once added" />
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
