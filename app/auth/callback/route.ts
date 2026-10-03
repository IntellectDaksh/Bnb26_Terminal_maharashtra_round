import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Google -> Supabase -> here with ?code=. Exchange it for a session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/register";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/register"; // no open redirect

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/register?auth_error=1`);
}
