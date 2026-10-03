"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";

function Login() {
  const params = useSearchParams();
  const requested = params.get("next") ?? "/events";
  const next = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") ? requested : "/events";
  const { user, loading, signIn } = useAuth();
  const [error, setError] = useState<string | null>(params.has("auth_error") ? "Google sign-in could not finish. Try again." : null);
  const [pending, setPending] = useState(false);
  async function login() {
    setPending(true);
    setError(null);
    try { await signIn(next); }
    catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed."); setPending(false); }
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4">
      <section className="w-full max-w-md space-y-6 rounded-3xl border border-zinc-200 bg-white p-8">
        <h1 className="text-2xl font-semibold">Sign in to Fair Drop</h1>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {loading ? <p>Checking your session…</p> : user ? <>
          <p className="text-sm">Signed in as {user.email}.</p>
          <Link href={next} className="underline">Continue</Link>
        </> : <Button variant="primary" disabled={pending} onClick={login}>Continue with Google</Button>}
        <p className="text-sm"><Link href="/events" className="underline">Browse events</Link></p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<p>Loading sign-in…</p>}><Login /></Suspense>;
}
