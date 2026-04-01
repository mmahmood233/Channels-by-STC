"use client";

import { useState, useTransition } from "react";
import { Plus, X, Trash2, ShoppingCart, Loader2, CheckCircle2 } from "lucide-react";
import { createSale, type SaleLineItem } from "@/app/actions/sales";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";

interface Device {
  id: string;
  name: string;
  brand: string;
  sku: string;
  unit_price: number;
}

interface NewSaleModalProps {
  storeId: string;
  devices: Device[];
}

export function NewSaleModal({ storeId, devices }: NewSaleModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saleDate, setSaleDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<
    { device_id: string; quantity: number; unit_price: number }[]
  >([{ device_id: "", quantity: 1, unit_price: 0 }]);

  function addItem() {
    setItems((prev) => [...prev, { device_id: "", quantity: 1, unit_price: 0 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(
    idx: number,
    field: keyof SaleLineItem,
    val: string | number
  ) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === "device_id") {
          const dev = devices.find((d) => d.id === val);
          return {
            ...item,
            device_id: String(val),
            unit_price: dev?.unit_price ?? 0,
          };
        }
        return { ...item, [field]: Number(val) };
      })
    );
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const validItems = items.filter((i) => i.device_id && i.quantity > 0);

  function submit() {
    if (!validItems.length) {
      setError("Add at least one item with a device selected.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createSale({
        store_id: storeId,
        sale_date: saleDate,
        notes,
        items: validItems,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(() => {
          setOpen(false);
          setDone(false);
          setItems([{ device_id: "", quantity: 1, unit_price: 0 }]);
          setNotes("");
          setSaleDate(new Date().toISOString().split("T")[0]);
        }, 1200);
      }
    });
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        <Plus className="h-4 w-4" />
        Record Sale
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !pending && setOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                  <ShoppingCart className="h-5 w-5 text-brand-700" />
                </div>
                <h2 className="font-semibold text-surface-900">Record Sale</h2>
              </div>
              <button
                onClick={() => !pending && setOpen(false)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
              {/* Date + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Sale Date</label>
                  <input
                    type="date"
                    value={saleDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Notes (optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Customer name, reference…"
                    className="input-field"
                  />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="label mb-0">Items</label>
                  <button
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const selectedDevice = devices.find(
                      (d) => d.id === item.device_id
                    );
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_80px_110px_32px] gap-2 items-center"
                      >
                        {/* Device select */}
                        <select
                          value={item.device_id}
                          onChange={(e) =>
                            updateItem(idx, "device_id", e.target.value)
                          }
                          className="input-field"
                        >
                          <option value="">— Select device —</option>
                          {devices.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.brand} {d.name} ({d.sku})
                            </option>
                          ))}
                        </select>

                        {/* Qty */}
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(idx, "quantity", e.target.value)
                          }
                          className="input-field text-center"
                          placeholder="Qty"
                        />

                        {/* Unit price */}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">
                            BD
                          </span>
                          <input
                            type="number"
                            step="0.001"
                            min={0}
                            value={item.unit_price}
                            onChange={(e) =>
                              updateItem(idx, "unit_price", e.target.value)
                            }
                            className="input-field pl-8"
                          />
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl bg-surface-50 px-4 py-3">
                <span className="text-sm font-medium text-surface-600">
                  Total ({validItems.length} item{validItems.length !== 1 ? "s" : ""})
                </span>
                <span className="text-lg font-bold text-surface-900">
                  {formatCurrency(total)}
                </span>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-surface-100 px-6 py-4">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={pending || done}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60",
                  done ? "bg-green-600" : "bg-brand-700 hover:bg-brand-800"
                )}
              >
                {done ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved!
                  </>
                ) : pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Record Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
