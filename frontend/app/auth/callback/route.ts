import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

// Google -> Supabase -> here with ?code=. Exchange it for a session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const jar = await cookies();
  let next = searchParams.get("next") ?? "/events";
  try { next = searchParams.get("next") ?? decodeURIComponent(jar.get("fd.auth.next")?.value ?? "/events"); }
  catch { next = "/events"; }
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/events";

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${safeNext}`);
      response.cookies.delete("fd.auth.next");
      return response;
    }
  }
  return NextResponse.redirect(`${origin}/login?auth_error=1`);
}
