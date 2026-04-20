"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { CheckCircle2, XCircle, X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/utils/cn";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const success = useCallback((message: string) => toast(message, "success"), [toast]);
  const error   = useCallback((message: string) => toast(message, "error"),   [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />,
    error:   <XCircle      className="h-4 w-4 shrink-0 text-red-500" />,
    warning: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />,
    info:    <Info          className="h-4 w-4 shrink-0 text-blue-500" />,
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-2xl border border-surface-100 bg-white px-4 py-3 shadow-lg transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      {icons[t.type]}
      <p className="text-sm text-surface-800 max-w-xs">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className="ml-2 rounded p-0.5 text-surface-400 hover:text-surface-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
