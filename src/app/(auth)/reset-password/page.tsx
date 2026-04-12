import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import Image from "next/image";

export default function ResetPasswordPage() {
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

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-surface-900">
          Set new password
        </h2>
        <p className="mt-2 text-sm text-surface-500">
          Choose a strong password for your account.
        </p>
      </div>

      <ResetPasswordForm />

      <div className="mt-12 text-center">
        <p className="text-xs text-surface-400">
          &copy; {new Date().getFullYear()} Channels by stc. All rights
          reserved.
        </p>
      </div>
    </div>
  );
}
