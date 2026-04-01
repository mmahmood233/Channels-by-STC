"use client";

import { useState, useTransition } from "react";
import { Plus, X, Trash2, ArrowLeftRight, Loader2, CheckCircle2 } from "lucide-react";
import { createTransfer, type TransferLineItem } from "@/app/actions/transfers-create";
import { cn } from "@/utils/cn";

interface Store {
  id: string;
  name: string;
  is_warehouse: boolean;
}

interface Device {
  id: string;
  name: string;
  brand: string;
  sku: string;
  quantity: number; // current stock at the source store
}

interface NewTransferModalProps {
  currentStoreId: string;
  allStores: Store[];
  inventoryAtCurrentStore: Device[];
  userRole: string;
}

export function NewTransferModal({
  currentStoreId,
  allStores,
  inventoryAtCurrentStore,
  userRole,
}: NewTransferModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherStores = allStores.filter((s) => s.id !== currentStoreId);

  const [sourceId, setSourceId] = useState(currentStoreId);
  const [destId, setDestId] = useState(otherStores[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ device_id: string; quantity: number }[]>([
    { device_id: "", quantity: 1 },
  ]);

  // For admin/warehouse: source can be anything — use inventory from DB
  const isPrivileged = userRole === "admin" || userRole === "warehouse_manager";

  function addItem() {
    setItems((prev) => [...prev, { device_id: "", quantity: 1 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: "device_id" | "quantity", val: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i !== idx ? item : { ...item, [field]: field === "quantity" ? Number(val) : val }))
    );
  }

  const validItems = items.filter((i) => i.device_id && i.quantity > 0);

  function submit() {
    if (!validItems.length) { setError("Add at least one item."); return; }
    if (sourceId === destId) { setError("Source and destination must be different."); return; }
    setError(null);
    startTransition(async () => {
      const result = await createTransfer({
        source_store_id: sourceId,
        destination_store_id: destId,
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
          setItems([{ device_id: "", quantity: 1 }]);
          setNotes("");
        }, 1200);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        <Plus className="h-4 w-4" />
        Request Transfer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !pending && setOpen(false)}
          />

          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50">
                  <ArrowLeftRight className="h-5 w-5 text-purple-700" />
                </div>
                <h2 className="font-semibold text-surface-900">Request Transfer</h2>
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
              {/* From → To */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">From</label>
                  {isPrivileged ? (
                    <select
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                      className="input-field"
                    >
                      {allStores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="input-field bg-surface-50 text-surface-600">
                      {allStores.find((s) => s.id === currentStoreId)?.name ?? "Your Store"}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">To</label>
                  <select
                    value={destId}
                    onChange={(e) => setDestId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">— Select destination —</option>
                    {allStores
                      .filter((s) => s.id !== sourceId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.is_warehouse ? " (Warehouse)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for transfer…"
                  className="input-field"
                />
              </div>

              {/* Items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="label mb-0">Devices to Transfer</label>
                  <button
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add device
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const dev = inventoryAtCurrentStore.find(
                      (d) => d.id === item.device_id
                    );
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_90px_32px] gap-2 items-center"
                      >
                        <div>
                          <select
                            value={item.device_id}
                            onChange={(e) =>
                              updateItem(idx, "device_id", e.target.value)
                            }
                            className="input-field"
                          >
                            <option value="">— Select device —</option>
                            {inventoryAtCurrentStore.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.brand} {d.name} — {d.quantity} in stock
                              </option>
                            ))}
                          </select>
                          {dev && item.quantity > dev.quantity && (
                            <p className="mt-0.5 text-xs text-amber-600">
                              Only {dev.quantity} available
                            </p>
                          )}
                        </div>

                        <input
                          type="number"
                          min={1}
                          max={dev?.quantity ?? undefined}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(idx, "quantity", e.target.value)
                          }
                          className="input-field text-center"
                          placeholder="Qty"
                        />

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
                  <><CheckCircle2 className="h-4 w-4" /> Submitted!</>
                ) : pending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                ) : (
                  <><ArrowLeftRight className="h-4 w-4" /> Submit Request</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
