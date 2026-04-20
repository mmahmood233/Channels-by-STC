"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Truck, PackageCheck, Loader2 } from "lucide-react";
import { approveTransfer, rejectTransfer, markInTransit, completeTransfer } from "@/app/actions/transfers";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/utils/cn";

interface TransferActionsProps {
  transferId: string;
  status: string;
  userRole: string;
}

export function TransferActions({ transferId, status, userRole }: TransferActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  const canApprove =
    (userRole === "admin" || userRole === "warehouse_manager") &&
    status === "pending";
  const canReject =
    (userRole === "admin" || userRole === "warehouse_manager") &&
    (status === "pending" || status === "approved");
  const canTransit = status === "approved";
  const canComplete = status === "in_transit";

  if (!canApprove && !canReject && !canTransit && !canComplete) return null;

  function run(action: () => Promise<{ error?: string; success?: boolean }>, successMsg: string) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) { setError(result.error); toastError(result.error); }
      else success(successMsg);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {canApprove && (
        <ActionBtn
          onClick={() => run(() => approveTransfer(transferId), "Transfer approved")}
          pending={pending}
          color="green"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Approve"
        />
      )}
      {canTransit && (
        <ActionBtn
          onClick={() => run(() => markInTransit(transferId), "Marked as in transit")}
          pending={pending}
          color="blue"
          icon={<Truck className="h-3.5 w-3.5" />}
          label="In Transit"
        />
      )}
      {canComplete && (
        <ActionBtn
          onClick={() => run(() => completeTransfer(transferId), "Transfer completed")}
          pending={pending}
          color="purple"
          icon={<PackageCheck className="h-3.5 w-3.5" />}
          label="Complete"
        />
      )}
      {canReject && (
        <ActionBtn
          onClick={() => run(() => rejectTransfer(transferId), "Transfer rejected")}
          pending={pending}
          color="red"
          icon={<XCircle className="h-3.5 w-3.5" />}
          label="Reject"
        />
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function ActionBtn({
  onClick,
  pending,
  color,
  icon,
  label,
}: {
  onClick: () => void;
  pending: boolean;
  color: "green" | "blue" | "red" | "purple";
  icon: React.ReactNode;
  label: string;
}) {
  const colors = {
    green: "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    red: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    purple: "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100",
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
