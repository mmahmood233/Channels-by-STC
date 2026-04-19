"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-600 shadow-sm hover:bg-surface-50 active:scale-95 transition-all"
    >
      <Printer className="h-4 w-4" />
      Print / PDF
    </button>
  );
}
