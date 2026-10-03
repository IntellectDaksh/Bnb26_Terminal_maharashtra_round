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
 * full journey runs with zero setup. Admin role comes from
 * app_metadata.role === "admin" in the JWT. The UI only hides things,
 * proxy.ts and the backend enforce.
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
    const { data } = sb.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user;
      setUser(
        u
          ? {
              id: u.id,
              name: (u.user_metadata?.full_name as string) ?? u.email ?? "Participant",
              email: u.email ?? "",
              isAdmin: u.app_metadata?.role === "admin",
              mock: false,
            }
          : null,
      );
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (next = "/register", asAdmin = false) => {
    const sb = supabaseBrowser();
    if (!sb) {
      const u = { id: "demo-user", name: asAdmin ? "Demo admin" : "Demo participant", email: "demo@fairdrop.local", isAdmin: asAdmin };
      localStorage.setItem(MOCK_KEY, JSON.stringify(u));
      setUser({ ...u, mock: true });
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
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
