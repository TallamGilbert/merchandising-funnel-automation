"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthError, authApi, SessionUser, UNAUTHORIZED_EVENT } from "./client";

type Status = "loading" | "signed-in" | "signed-out" | "unreachable";

interface AuthContextValue {
  status: Status;
  user: SessionUser | null;
  /** Set by a successful sign-in or password change. */
  setUser: (user: SessionUser) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Re-check the session this often while the app is open (catches deactivation/reset). */
const RECHECK_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUserState] = useState<SessionUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUserState(me);
      setStatus("signed-in");
    } catch (error) {
      if (error instanceof AuthError && (error.status === 401 || error.status === 403)) {
        setUserState(null);
        setStatus("signed-out");
      } else {
        // Directory down or offline: keep whoever is signed in, retry later.
        setStatus((s) => (s === "loading" ? "unreachable" : s));
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onUnauthorized = () => {
      setUserState(null);
      setStatus("signed-out");
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    const timer = window.setInterval(() => void refresh(), RECHECK_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const setUser = useCallback((next: SessionUser) => {
    setUserState(next);
    setStatus("signed-in");
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setUserState(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo(() => ({ status, user, setUser, signOut, refresh }), [status, user, setUser, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in user; only call below an <AuthGate>, which guarantees one. */
export function useCurrentUser(): SessionUser {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser must be used inside <AuthGate>");
  return user;
}
