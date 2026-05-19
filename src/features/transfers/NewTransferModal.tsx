"use client";

import { useState, useTransition } from "react";
import { Plus, X, Trash2, ArrowLeftRight, Loader2, CheckCircle2 } from "lucide-react";
import { createTransfer } from "@/app/actions/transfers-create";
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
  allStores?: Store[];
  inventoryAtCurrentStore?: Device[];
  inventoryByStore?: Record<string, Device[]>;
  userRole: string;
}

export function NewTransferModal({
  currentStoreId,
  allStores: initialStores = [],
  inventoryAtCurrentStore: initialInventory = [],
  inventoryByStore: initialInventoryByStore,
  userRole,
}: NewTransferModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loadingData, setLoadingData] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStores, setAllStores] = useState<Store[]>(initialStores);
  const [inventoryByStore, setInventoryByStore] = useState<Record<string, Device[]>>(
    initialInventoryByStore ?? {}
  );
  const [inventoryAtCurrentStore, setInventoryAtCurrentStore] = useState<Device[]>(
    initialInventory
  );

  const otherStores = allStores.filter((s) => s.id !== currentStoreId);
  const sourceOptions = allStores.some((s) => s.is_warehouse)
    ? allStores.filter((s) => s.is_warehouse)
    : otherStores;
  const isPrivileged = userRole === "admin" || userRole === "warehouse_manager";
  const defaultSourceId = isPrivileged
    ? currentStoreId
    : (sourceOptions[0]?.id ?? "");
  const defaultDestinationId = isPrivileged
    ? (otherStores[0]?.id ?? "")
    : currentStoreId;

  const [sourceId, setSourceId] = useState(defaultSourceId);
  const [destId, setDestId] = useState(defaultDestinationId);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ device_id: string; quantity: number }[]>([
    { device_id: "", quantity: 1 },
  ]);
  const currentSourceInventory = inventoryByStore?.[sourceId] ?? inventoryAtCurrentStore;

  async function loadModalData() {
    if (allStores.length > 0 && Object.keys(inventoryByStore).length > 0) return;

    setLoadingData(true);
    setError(null);
    try {
      const response = await fetch("/api/transfers/modal-data");
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error ?? "Failed to load transfer data");

      const nextStores = data.stores ?? [];
      const nextInventoryByStore = data.inventoryByStore ?? {};
      const nextSourceId = data.defaultSourceId ?? defaultSourceId;

      setAllStores(nextStores);
      setInventoryByStore(nextInventoryByStore);
      setInventoryAtCurrentStore(nextInventoryByStore[nextSourceId] ?? []);
      setSourceId(nextSourceId);
      setDestId(
        userRole === "admin" || userRole === "warehouse_manager"
          ? nextStores.find((store: Store) => store.id !== nextSourceId)?.id ?? ""
          : data.currentStoreId ?? currentStoreId
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transfer data");
    } finally {
      setLoadingData(false);
    }
  }

  function openModal() {
    setSourceId(defaultSourceId);
    setDestId(defaultDestinationId);
    setItems([{ device_id: "", quantity: 1 }]);
    setNotes("");
    setError(null);
    setOpen(true);
    void loadModalData();
  }

  function changeSource(nextSourceId: string) {
    setSourceId(nextSourceId);
    setItems([{ device_id: "", quantity: 1 }]);
    setError(null);

    if (nextSourceId === destId) {
      const nextDestination = allStores.find((store) => store.id !== nextSourceId)?.id ?? "";
      setDestId(nextDestination);
    }
  }

  function addItem() {
    setItems((prev) => [...prev, { device_id: "", quantity: 1 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: "device_id" | "quantity", val: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === "device_id") return { ...item, device_id: String(val), quantity: 1 };
        const dev = currentSourceInventory.find((d) => d.id === item.device_id);
        if (!dev) return { ...item, quantity: Number(val) };

        const usedInOtherRows = prev
          .filter((row, j) => j !== idx && row.device_id === item.device_id)
          .reduce((sum, row) => sum + row.quantity, 0);
        const remaining = dev.quantity - usedInOtherRows;
        return { ...item, quantity: Math.min(Math.max(1, Number(val)), Math.max(1, remaining)) };
      })
    );
  }

  const validItems = items.filter((i) => i.device_id && i.quantity > 0);

  function submit() {
    if (!validItems.length) { setError("Add at least one item."); return; }
    if (sourceId === destId) { setError("Source and destination must be different."); return; }
    for (const item of validItems) {
      const requestedForDevice = validItems
        .filter((row) => row.device_id === item.device_id)
        .reduce((sum, row) => sum + row.quantity, 0);
      const available = currentSourceInventory.find((device) => device.id === item.device_id)?.quantity ?? 0;
      if (requestedForDevice > available) {
        setError("Requested quantity is greater than available stock at the source store.");
        return;
      }
    }
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
        onClick={openModal}
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
                      onChange={(e) => changeSource(e.target.value)}
                      className="input-field"
                    >
                      {allStores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={sourceId}
                      onChange={(e) => changeSource(e.target.value)}
                      className="input-field"
                    >
                      <option value="">— Select source —</option>
                      {sourceOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.is_warehouse ? " (Warehouse)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="label">To</label>
                  {isPrivileged ? (
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
                  ) : (
                    <div className="input-field bg-surface-50 text-surface-600">
                      {allStores.find((s) => s.id === currentStoreId)?.name ?? "Your Store"}
                    </div>
                  )}
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
                    disabled={loadingData || currentSourceInventory.length === 0}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add device
                  </button>
                </div>

                <div className="space-y-2">
                  {loadingData ? (
                    <div className="rounded-xl border border-surface-100 bg-surface-50 px-4 py-6 text-center text-sm text-surface-500">
                      Loading source inventory...
                    </div>
                  ) : items.map((item, idx) => {
                    const dev = currentSourceInventory.find(
                      (d) => d.id === item.device_id
                    );
                    const usedInOtherRows = items
                      .filter((row, j) => j !== idx && row.device_id === item.device_id)
                      .reduce((sum, row) => sum + row.quantity, 0);
                    const remaining = dev ? dev.quantity - usedInOtherRows : 0;
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
                            {currentSourceInventory.map((d) => {
                              const usedElsewhere = items
                                .filter((row, j) => j !== idx && row.device_id === d.id)
                                .reduce((sum, row) => sum + row.quantity, 0);
                              const availableForRow = d.quantity - usedElsewhere;
                              return (
                                <option key={d.id} value={d.id} disabled={availableForRow <= 0}>
                                  {d.brand} {d.name} — {availableForRow} in stock
                                </option>
                              );
                            })}
                          </select>
                          {dev && item.quantity >= remaining && remaining < dev.quantity && (
                            <p className="mt-0.5 text-xs text-amber-600">
                              {remaining} remaining after other rows
                            </p>
                          )}
                        </div>

                        <input
                          type="number"
                          min={1}
                          max={remaining > 0 ? remaining : undefined}
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
                disabled={pending || done || loadingData}
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
