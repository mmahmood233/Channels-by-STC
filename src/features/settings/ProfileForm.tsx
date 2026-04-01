"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, CheckCircle2 } from "lucide-react";
import { updateOwnProfile } from "@/app/actions/settings";

interface ProfileFormProps {
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
}

export function ProfileForm({ fullName, email, phone, role }: ProfileFormProps) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(fullName);
  const [phoneVal, setPhoneVal] = useState(phone ?? "");

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOwnProfile({
        full_name: name,
        phone: phoneVal || null,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            disabled
            className="input-field opacity-60 cursor-not-allowed"
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={phoneVal}
            onChange={(e) => setPhoneVal(e.target.value)}
            placeholder="+973 XXXX XXXX"
            className="input-field"
          />
        </Field>
        <Field label="Role">
          <input
            type="text"
            value={role}
            disabled
            className="input-field opacity-60 cursor-not-allowed capitalize"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save changes
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Saved!
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-surface-600">
        {label}
      </label>
      {children}
    </div>
  );
}
