// File purpose: Keeps Supabase sessions fresh and redirects users based on authentication state.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware runs before protected routes are opened.
// Its job is to keep the Supabase session fresh and redirect users when needed.
// Connects the application to Supabase authentication or database access.
export async function updateSession(request: NextRequest) {
  // Default response lets the request continue.
  // It may be replaced later if Supabase updates cookies.
  let supabaseResponse = NextResponse.next({ request });

  // Middleware Supabase client reads cookies from the incoming request.
  // It can also write refreshed auth cookies into the response.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Give Supabase all current auth cookies.
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies first so the current request has fresh session data.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          // Update response cookies so the browser keeps the refreshed session.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // These routes are public or need to run without a dashboard session.
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/api/auth") ||
    request.nextUrl.pathname.startsWith("/api/cron");

  // Unauthenticated users cannot access dashboard pages.
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If a logged-in user opens login, send them to dashboard instead.
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
