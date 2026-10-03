export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ok: true,
    mode: process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock",
    server_time: new Date().toISOString(),
  });
}
