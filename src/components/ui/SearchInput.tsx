"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useCallback, useRef } from "react";

interface Props {
  placeholder?: string;
  paramName?: string; // default "q"
}

export function SearchInput({ placeholder = "Search…", paramName = "q" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramName) ?? "";
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set(paramName, val);
    else params.delete(paramName);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, paramName]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => update(e.target.value), 300);
  }

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 h-4 w-4 text-surface-400 pointer-events-none" />
      <input
        type="search"
        defaultValue={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-9 w-56 rounded-xl border border-surface-200 bg-white pl-9 pr-8 text-sm text-surface-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {value && (
        <button
          onClick={() => update("")}
          className="absolute right-2.5 text-surface-400 hover:text-surface-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
