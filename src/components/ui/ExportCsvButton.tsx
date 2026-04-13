"use client";

import { Download } from "lucide-react";
import { exportToCsv } from "@/utils/exportCsv";

interface ExportCsvButtonProps {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  label?: string;
}

export function ExportCsvButton({ filename, headers, rows, label = "Export CSV" }: ExportCsvButtonProps) {
  return (
    <button
      onClick={() => exportToCsv(filename, headers, rows)}
      className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-medium text-surface-600 shadow-sm transition-colors hover:border-surface-300 hover:bg-surface-50"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
