// File purpose: Contains reusable profile service functions.
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<any, "public", any>;

// Groups reusable service logic used by pages or feature components.
export async function getProfile(supabase: Client, userId: string) {
  return supabase.from("profiles").select("*").eq("id", userId).single();
}

// Groups reusable service logic used by pages or feature components.
export async function getProfiles(supabase: Client) {
  return supabase
    .from("profiles")
    .select("*, stores(name)")
    .order("created_at", { ascending: false });
}

// Groups reusable service logic used by pages or feature components.
export async function updateProfile(
  supabase: Client,
  userId: string,
  updates: { full_name?: string; phone?: string | null; avatar_url?: string | null }
) {
  return supabase.from("profiles").update(updates).eq("id", userId);
}
