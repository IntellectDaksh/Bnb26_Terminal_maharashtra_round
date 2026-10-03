"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button, Wordmark, buttonClass, LoadingDots } from "@/components/ui";

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
    <main className="auth-page">
      <section className="auth-card space-y-6">
        <Link href="/" aria-label="Fair Drop home"><Wordmark /></Link>
        <div>
          <p className="eyebrow mt-8">Your next moment awaits</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome to Fair Drop.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">Sign in with Google to manage your entries and tickets.</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {loading ? <LoadingDots>Checking your session</LoadingDots> : user ? <>
          <p className="text-sm">Signed in as {user.email}.</p>
          <Link href={next} className={buttonClass("primary")}>Continue →</Link>
        </> : <Button variant="primary" className="w-full" loading={pending} onClick={login}>Continue with Google</Button>}
        <p className="border-t border-line pt-5 text-center text-sm"><Link href="/events" className="text-muted hover:text-fg">Browse events →</Link></p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="auth-page"><LoadingDots>Loading sign-in</LoadingDots></main>}><Login /></Suspense>;
}
