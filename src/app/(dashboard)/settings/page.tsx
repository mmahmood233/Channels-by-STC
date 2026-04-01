import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/features/settings/ProfileForm";
import { ROLE_LABELS } from "@/constants";
import type { UserRole } from "@/types";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, phone, store_id, created_at, stores(name)")
    .eq("id", session.user.id)
    .single();
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";

  // Fetch system settings (admin only)
  const { data: settings } = isAdmin
    ? await supabase.from("settings").select("key, value, description").order("key")
    : { data: null };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Profile Section ──────────────────────────────────────── */}
      <Section title="Profile" description="Update your name and contact details.">
        {/* Avatar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
            {profile.full_name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-semibold text-surface-900">{profile.full_name}</p>
            <p className="text-sm text-surface-500">{profile.email}</p>
            <p className="mt-0.5 text-xs text-surface-400">
              {ROLE_LABELS[profile.role as UserRole]}
              {(profile.stores as unknown as { name: string } | null)
                ? ` · ${(profile.stores as unknown as { name: string }).name}`
                : ""}
            </p>
          </div>
        </div>

        <ProfileForm
          fullName={profile.full_name ?? ""}
          email={profile.email ?? ""}
          phone={profile.phone}
          role={ROLE_LABELS[profile.role as UserRole]}
        />
      </Section>

      {/* ── Account Info ─────────────────────────────────────────── */}
      <Section title="Account Information" description="Read-only account metadata.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoRow label="User ID" value={session.user.id} mono />
          <InfoRow
            label="Member Since"
            value={new Date(profile.created_at).toLocaleDateString("en-BH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          />
        </div>
      </Section>

      {/* ── System Settings (admin only) ─────────────────────────── */}
      {isAdmin && settings && settings.length > 0 && (
        <Section
          title="System Settings"
          description="Global configuration values stored in the database."
        >
          <div className="divide-y divide-surface-100 rounded-xl border border-surface-100">
            {settings.map((s) => (
              <div key={s.key} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-surface-700">{s.key}</p>
                  {s.description && (
                    <p className="mt-0.5 text-xs text-surface-400">{s.description}</p>
                  )}
                </div>
                <code className="shrink-0 rounded bg-surface-100 px-2 py-1 text-xs text-surface-700">
                  {s.value}
                </code>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-soft">
      <div className="mb-6 border-b border-surface-100 pb-4">
        <h3 className="font-semibold text-surface-900">{title}</h3>
        <p className="mt-0.5 text-sm text-surface-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-50 px-4 py-3">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className={`mt-0.5 text-sm text-surface-900 ${mono ? "font-mono break-all" : ""}`}>
        {value}
      </p>
    </div>
  );
}
