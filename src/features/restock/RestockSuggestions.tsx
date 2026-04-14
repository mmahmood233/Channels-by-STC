"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sparkles, RefreshCw, ArrowLeftRight, AlertTriangle,
  CheckCircle2, Loader2, TrendingDown, Package,
} from "lucide-react";
import { createTransfer } from "@/app/actions/transfers-create";
import { cn } from "@/utils/cn";
import type { RestockSuggestion } from "@/app/api/restock/route";

const URGENCY_CONFIG = {
  critical: { label: "Critical",  bg: "bg-red-50",    border: "border-red-200",   badge: "bg-red-100 text-red-700",    icon: "text-red-500"    },
  high:     { label: "High",      bg: "bg-amber-50",  border: "border-amber-200", badge: "bg-amber-100 text-amber-700", icon: "text-amber-500" },
  medium:   { label: "Medium",    bg: "bg-blue-50",   border: "border-blue-200",  badge: "bg-blue-100 text-blue-700",   icon: "text-blue-500"  },
};

function SuggestionCard({
  s,
  onTransfer,
  done,
  loading,
}: {
  s: RestockSuggestion;
  onTransfer: () => void;
  done: boolean;
  loading: boolean;
}) {
  const cfg = URGENCY_CONFIG[s.urgency];

  return (
    <div className={cn(
      "rounded-2xl border p-5 transition-all",
      done ? "border-green-200 bg-green-50" : `${cfg.border} ${cfg.bg}`
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm")}>
            <Package className={cn("h-4 w-4", done ? "text-green-600" : cfg.icon)} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-surface-900">{s.brand} {s.deviceName}</p>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", cfg.badge)}>
                {cfg.label}
              </span>
              <code className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-mono text-surface-500">
                {s.sku}
              </code>
            </div>
            <p className="mt-0.5 text-xs text-surface-500">
              {s.storeName}
            </p>
            <p className="mt-2 text-xs text-surface-600 leading-relaxed">{s.reason}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium text-surface-400 uppercase">Suggest</p>
          <p className="text-2xl font-bold text-surface-900">{s.suggestedQty}</p>
          <p className="text-[10px] text-surface-400">units</p>
        </div>
      </div>

      {/* Stock bar */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-surface-400 mb-1">
            <span>Current stock: <strong className="text-surface-700">{s.currentStock}</strong></span>
            <span>Forecast need: <strong className="text-surface-700">{s.predictedDemand}</strong></span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
            <div
              className={cn("h-full rounded-full transition-all", s.urgency === "critical" ? "bg-red-500" : s.urgency === "high" ? "bg-amber-500" : "bg-blue-500")}
              style={{ width: `${Math.min(100, s.predictedDemand > 0 ? (s.currentStock / s.predictedDemand) * 100 : 0)}%` }}
            />
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={onTransfer}
          disabled={loading || done}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
            done
              ? "bg-green-600 text-white"
              : loading
              ? "bg-surface-200 text-surface-500"
              : "bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:scale-95"
          )}
        >
          {done ? (
            <><CheckCircle2 className="h-3.5 w-3.5" /> Requested</>
          ) : loading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Requesting…</>
          ) : (
            <><ArrowLeftRight className="h-3.5 w-3.5" /> Request Transfer</>
          )}
        </button>
      </div>
    </div>
  );
}

const LOADING_STEPS = [
  { label: "Fetching stock levels…",       duration: 1200 },
  { label: "Reading forecast warnings…",   duration: 1200 },
  { label: "Analyzing sales velocity…",    duration: 1200 },
  { label: "Running AI analysis…",         duration: 99999 }, // stays until done
];

export function RestockSuggestions() {
  const [suggestions, setSuggestions] = useState<RestockSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [transferringIds, setTransferringIds] = useState<Set<string>>(new Set());
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({});

  async function fetchSuggestions() {
    setLoading(true);
    setLoadingStep(0);
    setError(null);

    // Animate through the first 3 steps while the real request runs
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    LOADING_STEPS.slice(0, -1).forEach((step, i) => {
      elapsed += step.duration;
      timers.push(setTimeout(() => setLoadingStep(i + 1), elapsed));
    });

    try {
      const res = await fetch("/api/restock");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuggestions(data.suggestions ?? []);
      setGeneratedAt(data.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
    }
  }

  useEffect(() => { fetchSuggestions(); }, []);

  async function handleTransfer(s: RestockSuggestion) {
    const key = `${s.deviceId}-${s.storeId}`;
    setTransferringIds(prev => new Set(prev).add(key));
    setTransferErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

    const result = await createTransfer({
      source_store_id: s.warehouseStoreId,
      destination_store_id: s.storeId,
      notes: `AI Restock: ${s.brand} ${s.deviceName} — ${s.reason}`,
      items: [{ device_id: s.deviceId, quantity: s.suggestedQty }],
    });

    setTransferringIds(prev => { const n = new Set(prev); n.delete(key); return n; });

    if (result.error) {
      setTransferErrors(prev => ({ ...prev, [key]: result.error! }));
    } else {
      setDoneIds(prev => new Set(prev).add(key));
    }
  }

  const criticalCount = suggestions.filter(s => s.urgency === "critical").length;
  const highCount     = suggestions.filter(s => s.urgency === "high").length;
  const doneCount     = doneIds.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <Sparkles className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-surface-500">
              {generatedAt
                ? `Generated ${new Date(generatedAt).toLocaleTimeString("en-BH", { hour: "2-digit", minute: "2-digit" })}`
                : "AI-powered restock analysis"}
            </p>
          </div>
        </div>
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-600 shadow-sm hover:bg-surface-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Regenerate
        </button>
      </div>

      {/* Summary */}
      {!loading && suggestions.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Suggestions" value={suggestions.length} />
          <StatCard label="Critical" value={criticalCount} color="text-red-600" />
          <StatCard label="High Priority" value={highCount} color="text-amber-600" />
          <StatCard label="Transfers Requested" value={doneCount} color="text-green-600" />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-surface-100 bg-white p-10 shadow-soft">
          <div className="flex flex-col items-center gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
              <Sparkles className="h-7 w-7 animate-pulse text-brand-600" />
            </div>
            <div className="w-full max-w-xs space-y-3">
              {LOADING_STEPS.map((step, i) => {
                const done    = i < loadingStep;
                const active  = i === loadingStep;
                return (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                      done   ? "bg-brand-600 text-white"
                             : active ? "bg-brand-100 text-brand-700 ring-2 ring-brand-300"
                             : "bg-surface-100 text-surface-400"
                    )}>
                      {done ? "✓" : i + 1}
                    </div>
                    <p className={cn(
                      "text-sm transition-colors",
                      done   ? "text-surface-400 line-through"
                             : active ? "font-semibold text-surface-800"
                             : "text-surface-400"
                    )}>
                      {step.label}
                    </p>
                    {active && <Loader2 className="ml-auto h-4 w-4 animate-spin text-brand-500" />}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-surface-400">This usually takes 5–10 seconds</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <p className="font-medium text-red-700">{error}</p>
          <button onClick={fetchSuggestions} className="mt-4 text-sm text-red-600 underline">Try again</button>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
          <p className="font-semibold text-green-700">All stocked up!</p>
          <p className="mt-1 text-sm text-green-600">No restock actions needed right now based on current data.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => {
            const key = `${s.deviceId}-${s.storeId}`;
            return (
              <div key={key}>
                <SuggestionCard
                  s={s}
                  onTransfer={() => handleTransfer(s)}
                  done={doneIds.has(key)}
                  loading={transferringIds.has(key)}
                />
                {transferErrors[key] && (
                  <p className="mt-1 px-2 text-xs text-red-600">{transferErrors[key]}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white px-5 py-4 shadow-soft">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className={cn("mt-1 text-xl font-bold text-surface-900", color)}>{value}</p>
    </div>
  );
}
