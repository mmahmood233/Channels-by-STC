// File purpose: Contains reusable authentication service functions.
import { createClient } from "@/lib/supabase/client";

// Groups reusable service logic used by pages or feature components.
export async function signIn(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

// Groups reusable service logic used by pages or feature components.
export async function signOut() {
  const supabase = createClient();
  return supabase.auth.signOut();
}

// Groups reusable service logic used by pages or feature components.
export async function resetPassword(email: string) {
  const supabase = createClient();
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/api/auth/callback`,
  });
}
