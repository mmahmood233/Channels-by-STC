import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md animate-fade-in">
      {/* Mobile logo */}
      <div className="mb-8 flex justify-center lg:hidden">
        <Image
          src="/images/logoSTC.png"
          alt="Channels by stc"
          width={180}
          height={45}
          priority
        />
      </div>

      {/* Back link */}
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-surface-500 transition-colors hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-surface-900">
          Reset password
        </h2>
        <p className="mt-2 text-sm text-surface-500">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      {/* Form */}
      <ForgotPasswordForm />

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-xs text-surface-400">
          &copy; {new Date().getFullYear()} Channels by stc. All rights
          reserved.
        </p>
      </div>
    </div>
  );
}
