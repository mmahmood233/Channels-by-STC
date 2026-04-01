"use client";

import { useState, useTransition } from "react";
import { Eye, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { acknowledgeAlert, resolveAlert, dismissAlert } from "@/app/actions/alerts";
import { cn } from "@/utils/cn";

interface AlertActionsProps {
  alertId: string;
  status: string;
}

export function AlertActions({ alertId, status }: AlertActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canAck = status === "active";
  const canResolve = status === "active" || status === "acknowledged";
  const canDismiss = status !== "resolved" && status !== "dismissed";

  function run(action: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {canAck && (
        <Btn
          onClick={() => run(() => acknowledgeAlert(alertId))}
          pending={pending}
          color="blue"
          icon={<Eye className="h-3.5 w-3.5" />}
          label="Acknowledge"
        />
      )}
      {canResolve && (
        <Btn
          onClick={() => run(() => resolveAlert(alertId))}
          pending={pending}
          color="green"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Resolve"
        />
      )}
      {canDismiss && (
        <Btn
          onClick={() => run(() => dismissAlert(alertId))}
          pending={pending}
          color="red"
          icon={<XCircle className="h-3.5 w-3.5" />}
          label="Dismiss"
        />
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function Btn({
  onClick, pending, color, icon, label,
}: {
  onClick: () => void;
  pending: boolean;
  color: "blue" | "green" | "red";
  icon: React.ReactNode;
  label: string;
}) {
  const colors = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    green: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
    red: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  };
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={cn(
        "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        colors[color]
      )}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}
