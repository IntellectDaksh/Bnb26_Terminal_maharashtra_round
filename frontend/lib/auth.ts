"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

export type AuthUser = { id: string; name: string; email: string; isAdmin: boolean; mock: boolean };

const MOCK_KEY = "fd.mock.user";

function readMockUser(): AuthUser | null {
  try {
    const u = JSON.parse(localStorage.getItem(MOCK_KEY) ?? "null");
    return u ? { ...u, mock: true } : null;
  } catch {
    return null;
  }
}

/**
 * Google via Supabase when configured; otherwise a local demo identity so the
 * full journey runs with zero setup. The live backend checks administrator
 * membership in its database; JWT metadata never grants privileges.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      // localStorage is only readable after mount; deferred to keep SSR markup stable
      queueMicrotask(() => {
        setUser(readMockUser());
        setLoading(false);
      });
      const onStorage = (e: StorageEvent) => e.key === MOCK_KEY && setUser(readMockUser());
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    let alive = true;
    let revision = 0;
    const { data } = sb.auth.onAuthStateChange((_evt, session) => {
      const current = ++revision;
      const u = session?.user;
      if (!u || !session) {
        setUser(null);
        setLoading(false);
        return;
      }
      const identity: AuthUser = {
        id: u.id, name: (u.user_metadata?.full_name as string) ?? u.email ?? "Participant",
        email: u.email ?? "", isAdmin: false, mock: false,
      };
      // No Supabase calls inside this callback: that can deadlock auth refresh.
      void (async () => {
        let isAdmin = false;
        try {
          const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
          const response = await fetch(`${base}/admin/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store", signal: AbortSignal.timeout(5000),
          });
          isAdmin = response.ok && (await response.json()).user_id === u.id;
        } catch { /* Failure never grants administrator privileges. */ }
        if (alive && current === revision) {
          setUser({ ...identity, isAdmin });
          setLoading(false);
        }
      })();
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (next = "/events", asAdmin = false) => {
    const sb = supabaseBrowser();
    if (!sb) {
      const u = { id: "demo-user", name: asAdmin ? "Demo admin" : "Demo participant", email: "demo@fairdrop.local", isAdmin: asAdmin };
      localStorage.setItem(MOCK_KEY, JSON.stringify(u));
      setUser({ ...u, mock: true });
      return;
    }
    document.cookie = `fd.auth.next=${encodeURIComponent(next)}; Path=/; SameSite=Lax; Max-Age=600`;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const sb = supabaseBrowser();
    if (sb) await sb.auth.signOut();
    else localStorage.removeItem(MOCK_KEY);
    setUser(null);
  }, []);

  return { user, loading, signIn, signOut, supabaseConfigured };
}
