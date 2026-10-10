"use client";

import { FormEvent, ReactNode, useState } from "react";
import { STAFF_ROLE_LABEL, StaffRole } from "../directory/client";
import { useAuth } from "./AuthProvider";
import { authApi } from "./client";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Renders the app only for a signed-in user whose role may use it; otherwise
 * the sign-in, choose-a-password or no-access screen. One sign-in covers
 * every MMS app (shared session cookie).
 */
export function AuthGate({
  appName,
  allow,
  children,
}: {
  appName: string;
  /** Roles that may use this app; omit to allow every signed-in role. */
  allow?: StaffRole[];
  children: ReactNode;
}) {
  const { status, user, refresh } = useAuth();

  if (status === "loading") {
    return <AuthFrame appName={appName}><p className="muted">Checking your session…</p></AuthFrame>;
  }
  if (status === "unreachable") {
    return (
      <AuthFrame appName={appName}>
        <p>Can&apos;t reach the sign-in service right now.</p>
        <button type="button" className="primary" onClick={() => void refresh()}>
          Try again
        </button>
      </AuthFrame>
    );
  }
  if (status === "signed-out" || !user) return <SignInScreen appName={appName} />;
  if (user.mustChangePassword) return <ChooseNewPasswordScreen appName={appName} />;
  if (allow && !allow.includes(user.role)) return <NoAccessScreen appName={appName} allow={allow} />;
  return <>{children}</>;
}

function AuthFrame({ appName, children }: { appName: string; children: ReactNode }) {
  return (
    <main className="mms-auth">
      <div className="mms-auth-card">
        <p className="mms-auth-app">{appName}</p>
        {children}
      </div>
    </main>
  );
}

function SignInScreen({ appName }: { appName: string }) {
  const { setUser } = useAuth();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setUser(await authApi.login(staffId, password));
    } catch (err) {
      setError((err as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame appName={appName}>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <label>
          Staff ID
          <input
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="mms-field-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="muted mms-auth-hint">Forgot your password? Ask your manager to reset it.</p>
    </AuthFrame>
  );
}

function ChooseNewPasswordScreen({ appName }: { appName: string }) {
  const { user, signOut } = useAuth();
  return (
    <AuthFrame appName={appName}>
      <h1>Choose a new password</h1>
      <p className="muted">
        {user?.name}, you&apos;re signed in with a temporary password. Choose your own to continue.
      </p>
      <ChangePasswordForm submitLabel="Save and continue" />
      <button type="button" className="mms-link-btn" onClick={() => void signOut()}>
        Sign out
      </button>
    </AuthFrame>
  );
}

function NoAccessScreen({ appName, allow }: { appName: string; allow: StaffRole[] }) {
  const { user, signOut } = useAuth();
  return (
    <AuthFrame appName={appName}>
      <h1>No access</h1>
      <p>
        You&apos;re signed in as {user?.name} ({user && STAFF_ROLE_LABEL[user.role]}). {appName} is for{" "}
        {allow.map((r) => STAFF_ROLE_LABEL[r]).join(", ")}.
      </p>
      <button type="button" onClick={() => void signOut()}>
        Sign in as someone else
      </button>
    </AuthFrame>
  );
}

/** Used by the forced change above and by the user menu's Change password. */
export function ChangePasswordForm({ submitLabel = "Change password", onDone }: { submitLabel?: string; onDone?: () => void }) {
  const { setUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
    if (next !== confirm) return setError("The new passwords don't match");
    setBusy(true);
    setError(null);
    try {
      setUser(await authApi.changePassword(current, next));
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Current password
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label>
        New password
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
      </label>
      <label>
        Confirm new password
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </label>
      {error && <p className="mms-field-error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
