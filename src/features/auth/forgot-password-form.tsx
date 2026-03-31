"use client";

import { useState } from "react";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/services/auth";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await resetPassword(email);

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="animate-scale-in rounded-2xl border border-surface-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-500/10">
          <CheckCircle2 className="h-7 w-7 text-success-600" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-surface-900">
          Check your email
        </h3>
        <p className="text-sm leading-relaxed text-surface-500">
          We&apos;ve sent a password reset link to{" "}
          <span className="font-medium text-surface-700">{email}</span>. Please
          check your inbox and follow the instructions.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="animate-slide-down rounded-xl border border-danger-500/20 bg-danger-500/5 px-4 py-3">
          <p className="text-sm font-medium text-danger-600">{error}</p>
        </div>
      )}

      {/* Email field */}
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-surface-700"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          autoComplete="email"
          autoFocus
          className="focus-ring block w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 shadow-card transition-all duration-200 placeholder:text-surface-400 hover:border-brand-300 focus:border-brand-500"
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="focus-ring group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-800 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-800/25 transition-all duration-300 hover:bg-brand-900 hover:shadow-xl hover:shadow-brand-800/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />

        {loading ? (
          <Loader2 className="h-4.5 w-4.5 animate-spin" />
        ) : (
          <Mail className="h-4.5 w-4.5" />
        )}
        <span className="relative">
          {loading ? "Sending..." : "Send reset link"}
        </span>
      </button>
    </form>
  );
}
