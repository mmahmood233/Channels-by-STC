"use client";

// File purpose: Contains a reusable UI component used by multiple pages or features.

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

// Renders a reusable UI element used across multiple dashboard modules.
export function DarkModeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-xl p-2 text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
