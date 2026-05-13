"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteCategory } from "@/app/actions/categories";
import { useToast } from "@/components/ui/Toast";

export function DeleteCategoryButton({ categoryId, deviceCount }: { categoryId: string; deviceCount: number }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const { success, error } = useToast();

  if (deviceCount > 0) return null;

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      const result = await deleteCategory(categoryId);
      if (result.error) error(result.error);
      else success("Category deleted");
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      onBlur={() => setConfirming(false)}
      className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : confirming ? "Confirm" : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
