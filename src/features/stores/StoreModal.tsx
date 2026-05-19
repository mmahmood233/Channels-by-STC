"use client";

// File purpose: Contains store and warehouse location UI.

import { useState, useTransition } from "react";
import { Building2, Loader2, Pencil, Plus, X } from "lucide-react";
import { createStore, updateStore } from "@/app/actions/stores";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/utils/cn";

interface StoreData {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  is_warehouse: boolean;
}

interface Props {
  store?: StoreData;
}

// Renders this feature UI and connects user actions to server-side logic.
export function StoreModal({ store }: Props) {
  const isEdit = Boolean(store);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({
    name: store?.name ?? "",
    code: store?.code ?? "",
    address: store?.address ?? "",
    city: store?.city ?? "",
    region: store?.region ?? "",
    phone: store?.phone ?? "",
    is_warehouse: store?.is_warehouse ?? false,
  });

  function handleOpen() {
    setForm({
      name: store?.name ?? "",
      code: store?.code ?? "",
      address: store?.address ?? "",
      city: store?.city ?? "",
      region: store?.region ?? "",
      phone: store?.phone ?? "",
      is_warehouse: store?.is_warehouse ?? false,
    });
    setError(null);
    setOpen(true);
  }

  function set(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEdit && store
        ? await updateStore(store.id, form)
        : await createStore(form);

      if (result.error) {
        setError(result.error);
        toastError(result.error);
      } else {
        setOpen(false);
        success(isEdit ? "Location updated" : "Location added");
      }
    });
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={handleOpen}
          className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-brand-600"
          title="Edit location"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Location
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-surface-900">
                  {isEdit ? "Edit Location" : "Add Location"}
                </h2>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name *">
                  <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Code *">
                  <input required value={form.code} onChange={(e) => set("code", e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Address">
                <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City">
                  <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Region">
                  <input value={form.region} onChange={(e) => set("region", e.target.value)} className={inputCls} />
                </Field>
                <Field label="Phone">
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
                </Field>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-surface-200 px-3 py-2 text-sm text-surface-700">
                <input
                  type="checkbox"
                  checked={form.is_warehouse}
                  onChange={(e) => set("is_warehouse", e.target.checked)}
                  className="h-4 w-4 rounded border-surface-300 text-brand-700"
                />
                Warehouse location
              </label>
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

// Renders this feature UI and connects user actions to server-side logic.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-surface-600">{label}</label>
      {children}
    </div>
  );
}

const inputCls = cn(
  "w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800",
  "focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
);
