// File purpose: Creates the browser-side Supabase client for client components and realtime features.
// Browser-side Supabase client — used in Client Components ("use client")
// For Server Components use createServerSupabaseClient from ./server
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// This client runs in the browser.
// Use it for client-only features such as realtime subscriptions.
// Do not use service role keys here because browser code is visible to users.
// Connects the application to Supabase authentication or database access.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
