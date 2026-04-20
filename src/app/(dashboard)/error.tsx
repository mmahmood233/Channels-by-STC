"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-surface-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-surface-500">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-surface-400">Ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
