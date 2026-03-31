"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { signIn } from "@/services/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await signIn(email, password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error message */}
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

      {/* Password field */}
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-surface-700"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            minLength={6}
            className="focus-ring block w-full rounded-xl border border-surface-200 bg-white px-4 py-3 pr-12 text-sm text-surface-900 shadow-card transition-all duration-200 placeholder:text-surface-400 hover:border-brand-300 focus:border-brand-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1 text-surface-400 transition-colors hover:text-surface-600"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4.5 w-4.5" />
            ) : (
              <Eye className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="focus-ring group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-800 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-800/25 transition-all duration-300 hover:bg-brand-900 hover:shadow-xl hover:shadow-brand-800/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {/* Shine effect on hover */}
        <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />

        {loading ? (
          <Loader2 className="h-4.5 w-4.5 animate-spin" />
        ) : (
          <LogIn className="h-4.5 w-4.5" />
        )}
        <span className="relative">
          {loading ? "Signing in..." : "Sign in"}
        </span>
      </button>
    </form>
  );
}
