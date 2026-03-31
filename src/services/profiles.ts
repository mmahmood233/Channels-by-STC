import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;

export async function getProfile(supabase: Client, userId: string) {
  return supabase.from("profiles").select("*").eq("id", userId).single();
}

export async function getProfiles(supabase: Client) {
  return supabase
    .from("profiles")
    .select("*, stores(name)")
    .order("created_at", { ascending: false });
}

export async function updateProfile(
  supabase: Client,
  userId: string,
  updates: { full_name?: string; phone?: string | null; avatar_url?: string | null }
) {
  return supabase.from("profiles").update(updates).eq("id", userId);
}
