// Server-side Turnstile check for mock mode. In live mode the backend's POST /register
// verifies the token itself; this route exists so the secret never reaches the browser.
export async function POST(request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };
  if (!token) return Response.json({ success: false, code: "missing_token" }, { status: 400 });
  if (!secret) return Response.json({ success: true, skipped: true }); // not configured: demo

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0];
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const out = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return Response.json({ success: out.success, codes: out["error-codes"] ?? [] }, { status: out.success ? 200 : 403 });
  } catch {
    return Response.json({ success: false, code: "siteverify_unreachable" }, { status: 502 });
  }
}
