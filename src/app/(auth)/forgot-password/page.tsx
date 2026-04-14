import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="animate-fade-in space-y-8">

      {/* Back link */}
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 transition-colors hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      {/* Header */}
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
          <Mail className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-surface-900">
          Reset your password
        </h2>
        <p className="mt-2 text-sm text-surface-500">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-surface-100 bg-white p-7 shadow-soft">
        <ForgotPasswordForm />
      </div>

      <p className="text-center text-xs text-surface-400">
        © {new Date().getFullYear()} Channels by stc · Smart Inventory System
      </p>
    </div>
  );
}
