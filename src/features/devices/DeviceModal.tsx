"use client";

import { useState, useTransition } from "react";
import { X, Plus, Pencil, Loader2 } from "lucide-react";
import { createDevice, updateDevice } from "@/app/actions/devices";
import { cn } from "@/utils/cn";

interface Category { id: string; name: string; }

interface DeviceData {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category_id: string | null;
  unit_price: number;
  cost_price: number | null;
  low_stock_threshold: number;
}

interface Props {
  categories: Category[];
  device?: DeviceData; // if provided → edit mode
}

export function DeviceModal({ categories, device }: Props) {
  const isEdit = !!device;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    sku:                 device?.sku                 ?? "",
    name:                device?.name                ?? "",
    brand:               device?.brand               ?? "",
    category_id:         device?.category_id         ?? "",
    unit_price:          device?.unit_price           ?? 0,
    cost_price:          device?.cost_price           ?? "",
    low_stock_threshold: device?.low_stock_threshold  ?? 5,
  });

  function set(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleOpen() {
    setForm({
      sku:                 device?.sku                 ?? "",
      name:                device?.name                ?? "",
      brand:               device?.brand               ?? "",
      category_id:         device?.category_id         ?? "",
      unit_price:          device?.unit_price           ?? 0,
      cost_price:          device?.cost_price           ?? "",
      low_stock_threshold: device?.low_stock_threshold  ?? 5,
    });
    setError(null);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      sku:                 form.sku,
      name:                form.name,
      brand:               form.brand,
      category_id:         form.category_id,
      unit_price:          Number(form.unit_price),
      cost_price:          form.cost_price !== "" ? Number(form.cost_price) : null,
      low_stock_threshold: Number(form.low_stock_threshold),
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateDevice(device.id, payload)
        : await createDevice(payload);

      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <>
      {/* Trigger */}
      {isEdit ? (
        <button
          onClick={handleOpen}
          className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-brand-600"
          title="Edit device"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Device
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
              <h2 className="text-base font-semibold text-surface-900">
                {isEdit ? "Edit Device" : "Add New Device"}
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="SKU *">
                  <input
                    required
                    value={form.sku}
                    onChange={e => set("sku", e.target.value)}
                    placeholder="e.g. AP-IP15-128"
                    className={inputCls}
                  />
                </Field>
                <Field label="Brand *">
                  <input
                    required
                    value={form.brand}
                    onChange={e => set("brand", e.target.value)}
                    placeholder="e.g. Apple"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Device Name *">
                <input
                  required
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="e.g. iPhone 15 128GB"
                  className={inputCls}
                />
              </Field>

              <Field label="Category">
                <select
                  value={form.category_id}
                  onChange={e => set("category_id", e.target.value)}
                  className={inputCls}
                >
                  <option value="">— None —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Selling Price (BHD) *">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.unit_price}
                    onChange={e => set("unit_price", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Cost Price (BHD)">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.cost_price}
                    onChange={e => set("cost_price", e.target.value)}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Low Stock Threshold *">
                <input
                  required
                  type="number"
                  min="0"
                  value={form.low_stock_threshold}
                  onChange={e => set("low_stock_threshold", e.target.value)}
                  className={cn(inputCls, "w-32")}
                />
                <p className="mt-1 text-xs text-surface-400">Alert triggers when stock falls below this number</p>
              </Field>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? "Save Changes" : "Add Device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-surface-600">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
