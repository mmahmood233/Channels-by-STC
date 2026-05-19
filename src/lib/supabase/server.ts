// File purpose: Creates Supabase clients for server-side authenticated and trusted backend operations.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// This file creates Supabase clients for server-side code.
// Server-side code includes pages, layouts, server actions, and API routes.

// Using `any` for the schema generic avoids "never" inference errors
// that occur with hand-written Database types and complex Supabase queries.
// Runtime behaviour is identical; full typed client can be generated later
// via `npx supabase gen types typescript`.
// Connects the application to Supabase authentication or database access.
export async function createServerSupabaseClient() {
  // Next.js stores the Supabase session in cookies.
  // Reading these cookies allows Supabase to know which user is logged in.
  const cookieStore = await cookies();

  // This client uses the public anon key and the user's session cookies.
  // It respects Row Level Security policies.
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // Supabase may update auth cookies when refreshing the session.
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

// Service role client is only for trusted backend code.
// It bypasses Row Level Security, so it must never be used in browser components.
// Connects the application to Supabase authentication or database access.
export async function createServiceRoleClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
