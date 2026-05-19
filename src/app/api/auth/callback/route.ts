// File purpose: Handles Supabase authentication callback redirects.
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Handles a backend API request, checks access, and returns JSON to the frontend.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const type = searchParams.get("type");

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Password recovery emails should land on the reset page
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
