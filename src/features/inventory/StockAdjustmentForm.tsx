"use client";

import { useState, useTransition } from "react";
import { Plus, Minus, Loader2, CheckCircle2, ArrowLeft, PackageCheck } from "lucide-react";
import { adjustStock } from "@/app/actions/inventory";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/utils/cn";

interface Store  { id: string; name: string; is_warehouse: boolean; }
interface Device { id: string; name: string; brand: string; sku: string; }

interface Props {
  stores: Store[];
  devices: Device[];
  defaultStoreId: string;
}

export function StockAdjustmentForm({ stores, devices, defaultStoreId }: Props) {
  const [storeId, setStoreId]     = useState(defaultStoreId || stores[0]?.id || "");
  const [deviceId, setDeviceId]   = useState("");
  const [mode, setMode]           = useState<"add" | "remove">("add");
  const [qty, setQty]             = useState(1);
  const [reason, setReason]       = useState("");
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult]  = useState<{ newQuantity: number; device: string } | null>(null);
  const { success, error: toastError } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceId) return;
    setLastResult(null);

    const adjustment = mode === "add" ? qty : -qty;
    const deviceName = devices.find(d => d.id === deviceId)?.name ?? "";

    startTransition(async () => {
      const result = await adjustStock({ store_id: storeId, device_id: deviceId, adjustment, reason });
      if (result.error) {
        toastError(result.error);
      } else {
        success(`Stock adjusted — new quantity: ${result.newQuantity}`);
        setLastResult({ newQuantity: result.newQuantity!, device: deviceName });
        setReason("");
        setQty(1);
      }
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Back link */}
      <a href="/inventory" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory
      </a>

      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-surface-100 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <PackageCheck className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900">Stock Adjustment</h2>
            <p className="text-xs text-surface-400">Manually correct inventory quantities</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Store */}
          <Field label="Store">
            <select value={storeId} onChange={e => setStoreId(e.target.value)} className={selectCls} required>
              <option value="">— Select store —</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.is_warehouse ? " (Warehouse)" : ""}
                </option>
              ))}
            </select>
          </Field>

          {/* Device */}
          <Field label="Device">
            <select value={deviceId} onChange={e => setDeviceId(e.target.value)} className={selectCls} required>
              <option value="">— Select device —</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.brand} {d.name} — {d.sku}
                </option>
              ))}
            </select>
          </Field>

          {/* Add / Remove toggle */}
          <Field label="Adjustment Type">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("add")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all",
                  mode === "add"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-surface-200 bg-white text-surface-600 hover:bg-surface-50"
                )}
              >
                <Plus className="h-4 w-4" /> Add Stock
              </button>
              <button
                type="button"
                onClick={() => setMode("remove")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all",
                  mode === "remove"
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-surface-200 bg-white text-surface-600 hover:bg-surface-50"
                )}
              >
                <Minus className="h-4 w-4" /> Remove Stock
              </button>
            </div>
          </Field>

          {/* Quantity */}
          <Field label="Quantity">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 hover:bg-surface-50">
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                className="w-20 rounded-xl border border-surface-200 py-2 text-center text-sm font-bold focus:border-brand-400 focus:outline-none"
              />
              <button type="button" onClick={() => setQty(q => q + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 hover:bg-surface-50">
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-sm text-surface-500">units will be {mode === "add" ? "added" : "removed"}</span>
            </div>
          </Field>

          {/* Reason */}
          <Field label="Reason *">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              required
              placeholder="e.g. Physical count correction, damaged goods, supplier delivery…"
              className="w-full rounded-xl border border-surface-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          {/* Result feedback */}
          {lastResult && (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">Adjustment applied</p>
                <p className="text-xs text-green-600">{lastResult.device} → new stock: <strong>{lastResult.newQuantity}</strong></p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !deviceId || !storeId}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition-all active:scale-95"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "add" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            {isPending ? "Applying…" : `${mode === "add" ? "Add" : "Remove"} ${qty} Unit${qty !== 1 ? "s" : ""}`}
          </button>
        </form>
      </div>
    </div>
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

const selectCls = "w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 focus:border-brand-400 focus:outline-none";
