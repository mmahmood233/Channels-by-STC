"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-surface-900">Password updated!</h3>
        <p className="text-sm text-surface-500">Redirecting you to the dashboard…</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* New password */}
      <div>
        <label className="label">New Password</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="input-field pl-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirm */}
      <div>
        <label className="label">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="Repeat password"
            className="input-field pl-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirm && password !== confirm && (
          <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 disabled:opacity-60"
      >
        <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
        {pending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
        ) : (
          <><Lock className="h-4 w-4" /> Set New Password</>
        )}
      </button>
    </form>
  );
}
