"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Calendar } from "lucide-react";

const PRESETS = [
  { label: "Last 3 months",  months: 3 },
  { label: "Last 6 months",  months: 6 },
  { label: "Last 12 months", months: 12 },
  { label: "This year",      months: 0, thisYear: true },
];

interface Props {
  from: string;
  to: string;
}

export function DateRangePicker({ from, to }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback((newFrom: string, newTo: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  function applyPreset(months: number, thisYear?: boolean) {
    const now = new Date();
    const to = now.toISOString().split("T")[0];
    let fromDate: Date;
    if (thisYear) {
      fromDate = new Date(now.getFullYear(), 0, 1);
    } else {
      fromDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    }
    update(fromDate.toISOString().split("T")[0], to);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="h-4 w-4 shrink-0 text-surface-400" />

      {/* Preset buttons */}
      {PRESETS.map((p) => {
        const now = new Date();
        const presetTo = now.toISOString().split("T")[0];
        let presetFrom: string;
        if (p.thisYear) {
          presetFrom = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
        } else {
          presetFrom = new Date(now.getFullYear(), now.getMonth() - p.months + 1, 1).toISOString().split("T")[0];
        }
        const active = from === presetFrom && to === presetTo;
        return (
          <button
            key={p.label}
            onClick={() => applyPreset(p.months, p.thisYear)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50"
            }`}
          >
            {p.label}
          </button>
        );
      })}

      {/* Custom range inputs */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => update(e.target.value, to)}
          className="rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-xs text-surface-700 focus:border-brand-400 focus:outline-none"
        />
        <span className="text-xs text-surface-400">to</span>
        <input
          type="date"
          value={to}
          min={from}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => update(from, e.target.value)}
          className="rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-xs text-surface-700 focus:border-brand-400 focus:outline-none"
        />
      </div>
    </div>
  );
}
