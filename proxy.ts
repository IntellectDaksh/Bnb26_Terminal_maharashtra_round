import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Refreshes the Supabase session cookie on every request and gates /admin.
// This is an optimistic check: the backend must still verify the JWT role.
export async function proxy(request: NextRequest) {
  const isAdmin = request.nextUrl.pathname.startsWith("/admin");

  if (!URL_ || !KEY) {
    // No Supabase: demo mode. Admin stays reachable only while the API is mocked.
    if (isAdmin && process.env.NEXT_PUBLIC_API_MODE === "live") return NextResponse.redirect(new URL("/?denied=admin", request.url));
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(URL_, KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (isAdmin) {
    const role = (data?.claims?.app_metadata as { role?: string } | undefined)?.role;
    if (!data?.claims) return NextResponse.redirect(new URL(`/register?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
    if (role !== "admin") return NextResponse.redirect(new URL("/?denied=admin", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
