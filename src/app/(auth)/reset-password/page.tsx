import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <div className="animate-fade-in space-y-8">

      {/* Header */}
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
          <KeyRound className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-surface-900">
          Set new password
        </h2>
        <p className="mt-2 text-sm text-surface-500">
          Choose a strong password for your account.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-surface-100 bg-white p-7 shadow-soft">
        <ResetPasswordForm />
      </div>

      <p className="text-center text-xs text-surface-400">
        © {new Date().getFullYear()} Channels by stc · Smart Inventory System
      </p>
    </div>
  );
}
