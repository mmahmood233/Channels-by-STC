"use client";

// File purpose: Contains a reusable UI component used by multiple pages or features.

import { Printer } from "lucide-react";

// Renders a reusable UI element used across multiple dashboard modules.
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
