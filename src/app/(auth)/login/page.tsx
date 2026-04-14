import { LoginForm } from "@/features/auth/login-form";
import Link from "next/link";
import { Lock } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="animate-fade-in space-y-8">

      {/* Header */}
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
          <Lock className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-surface-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-sm text-surface-500">
          Enter your credentials to access the dashboard
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-surface-100 bg-white p-7 shadow-soft">
        <LoginForm />

        <div className="mt-5 text-center">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand-700 transition-colors hover:text-brand-900"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      {/* Security note */}
      <p className="text-center text-xs text-surface-400">
        Protected by Supabase Auth · TLS encrypted
      </p>
    </div>
  );
}
