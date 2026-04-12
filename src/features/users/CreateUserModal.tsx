"use client";

import { useState, useTransition } from "react";
import { UserPlus, X, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { createUser } from "@/app/actions/create-user";
import { cn } from "@/utils/cn";

interface Store {
  id: string;
  name: string;
  is_warehouse: boolean;
}

interface CreateUserModalProps {
  stores: Store[];
}

const ROLES = [
  { value: "store_manager", label: "Store Manager" },
  { value: "warehouse_manager", label: "Warehouse Manager" },
  { value: "admin", label: "Admin" },
];

export function CreateUserModal({ stores }: CreateUserModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("store_manager");
  const [storeId, setStoreId] = useState("");

  const needsStore = role === "store_manager";

  function reset() {
    setEmail(""); setPassword(""); setFullName("");
    setRole("store_manager"); setStoreId(""); setError(null); setDone(false);
  }

  function submit() {
    if (!email || !password || !fullName) {
      setError("All fields are required."); return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    if (needsStore && !storeId) {
      setError("Select a store for store managers."); return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createUser({
        email, password, full_name: fullName, role,
        store_id: needsStore ? storeId : null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(() => { setOpen(false); reset(); }, 1500);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        <UserPlus className="h-4 w-4" />
        Add User
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !pending && setOpen(false)} />

          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                  <UserPlus className="h-5 w-5 text-brand-700" />
                </div>
                <h2 className="font-semibold text-surface-900">Add New User</h2>
              </div>
              <button onClick={() => !pending && setOpen(false)} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ahmed Al-Doseri" className="input-field" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@channels.com" className="input-field" />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters" className="input-field pr-10" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {needsStore && (
                <div>
                  <label className="label">Assigned Store</label>
                  <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="input-field">
                    <option value="">— Select store —</option>
                    {stores.filter((s) => !s.is_warehouse).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-surface-100 px-6 py-4">
              <button onClick={() => setOpen(false)} disabled={pending}
                className="rounded-xl border border-surface-200 px-4 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={submit} disabled={pending || done}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60",
                  done ? "bg-green-600" : "bg-brand-700 hover:bg-brand-800"
                )}>
                {done ? <><CheckCircle2 className="h-4 w-4" /> Created!</>
                  : pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  : <><UserPlus className="h-4 w-4" /> Create User</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
