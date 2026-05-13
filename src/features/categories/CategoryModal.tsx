"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Tags, X } from "lucide-react";
import { createCategory, updateCategory } from "@/app/actions/categories";
import { useToast } from "@/components/ui/Toast";

interface CategoryData {
  id: string;
  name: string;
  description: string | null;
}

export function CategoryModal({ category }: { category?: CategoryData }) {
  const isEdit = Boolean(category);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({
    name: category?.name ?? "",
    description: category?.description ?? "",
  });

  function handleOpen() {
    setForm({
      name: category?.name ?? "",
      description: category?.description ?? "",
    });
    setError(null);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEdit && category
        ? await updateCategory(category.id, form)
        : await createCategory(form);

      if (result.error) {
        setError(result.error);
        toastError(result.error);
      } else {
        setOpen(false);
        success(isEdit ? "Category updated" : "Category added");
      }
    });
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={handleOpen}
          className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-brand-600"
          title="Edit category"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-surface-900">
                  {isEdit ? "Edit Category" : "Add Category"}
                </h2>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-600">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-600">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className={inputCls}
                />
              </div>
              {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls =
  "w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
