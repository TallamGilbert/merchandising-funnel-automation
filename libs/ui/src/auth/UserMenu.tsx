"use client";

import { useState } from "react";
import { appAt, appsFor } from "../apps/apps";
import { Modal } from "../components/Modal";
import { STAFF_ROLE_LABEL } from "../directory/client";
import { ChangePasswordForm } from "./AuthGate";
import { useAuth } from "./AuthProvider";

/**
 * Signed-in person, the other apps their role can use, Change password and
 * Sign out — sits in each app's top bar.
 */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  if (!user) return null;

  // Only rendered once the session has loaded in the browser, so window exists.
  const here = appAt(window.location.origin);
  const otherApps = appsFor(user.role).filter((app) => app.id !== here?.id);

  return (
    <div className="mms-user-menu">
      <button type="button" className="mms-user-button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="mms-user-avatar" aria-hidden>
          {initials(user.name)}
        </span>
        <span className="mms-user-text">
          <span className="mms-user-name">{user.name}</span>
          <span className="mms-user-role">{STAFF_ROLE_LABEL[user.role]}</span>
        </span>
      </button>
      {open && (
        <div className="mms-user-dropdown" role="menu" onMouseLeave={() => setOpen(false)}>
          {otherApps.length > 0 && (
            <>
              <p className="mms-user-section">Switch app</p>
              {otherApps.map((app) => (
                <a key={app.id} role="menuitem" href={app.url}>
                  {app.name}
                </a>
              ))}
              <hr className="mms-user-divider" />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setChanging(true);
            }}
          >
            Change password
          </button>
          <button type="button" role="menuitem" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}
      <Modal open={changing} onClose={() => setChanging(false)} title="Change password">
        <ChangePasswordForm onDone={() => setChanging(false)} />
      </Modal>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}
