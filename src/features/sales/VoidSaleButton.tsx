"use client";

import { useState, useTransition } from "react";
import { Ban, X, Loader2 } from "lucide-react";
import { voidSale } from "@/app/actions/sales";
import { useToast } from "@/components/ui/Toast";

interface Props {
  saleId: string;
  isVoided: boolean;
}

export function VoidSaleButton({ saleId, isVoided }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  if (isVoided) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
        Voided
      </span>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError("Please provide a reason"); return; }
    setError(null);
    startTransition(async () => {
      const result = await voidSale(saleId, reason.trim());
      if (result.error) {
        setError(result.error);
        toastError(result.error);
      } else {
        setOpen(false);
        setReason("");
        success("Sale voided — stock has been reversed");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); setReason(""); }}
        className="rounded-lg p-1.5 text-surface-300 transition-colors hover:bg-red-50 hover:text-red-500"
        title="Void sale"
      >
        <Ban className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-surface-900">Void Sale</h3>
                <p className="mt-1 text-sm text-surface-500">
                  This will reverse the stock movement and mark the sale as voided.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-surface-400 hover:bg-surface-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-surface-600">
                  Reason *
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Customer returned device, duplicate entry…"
                  className="w-full rounded-xl border border-surface-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-surface-200 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Void Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
