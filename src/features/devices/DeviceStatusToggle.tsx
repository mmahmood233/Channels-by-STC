"use client";

import { useTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { toggleDeviceStatus } from "@/app/actions/devices";

interface Props {
  deviceId: string;
  currentStatus: string;
}

export function DeviceStatusToggle({ deviceId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isActive = currentStatus === "active";

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleDeviceStatus(deviceId, currentStatus);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
          isActive
            ? "bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-green-50 text-green-600 hover:bg-green-100"
        }`}
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isActive ? (
          "Deactivate"
        ) : (
          "Activate"
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
