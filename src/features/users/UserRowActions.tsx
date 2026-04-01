"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserX, Loader2 } from "lucide-react";
import { updateUserStatus } from "@/app/actions/users";
import { cn } from "@/utils/cn";

interface UserRowActionsProps {
  userId: string;
  currentStatus: string;
  currentUserId: string;
}

export function UserRowActions({ userId, currentStatus, currentUserId }: UserRowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isSelf = userId === currentUserId;
  if (isSelf) return <span className="text-xs text-surface-400">You</span>;

  function toggle() {
    setError(null);
    startTransition(async () => {
      const next = currentStatus === "active" ? "inactive" : "active";
      const result = await updateUserStatus(userId, next);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={pending}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
          currentStatus === "active"
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : currentStatus === "active" ? (
          <UserX className="h-3.5 w-3.5" />
        ) : (
          <UserCheck className="h-3.5 w-3.5" />
        )}
        {currentStatus === "active" ? "Deactivate" : "Activate"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
