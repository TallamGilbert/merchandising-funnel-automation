"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

export type FlashKind = "success" | "error" | "info";

interface FlashMessage {
  id: number;
  kind: FlashKind;
  message: string;
}

interface FlashApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const FlashContext = createContext<FlashApi | null>(null);

/** Success and info messages fade on their own; errors stay until dismissed. */
const AUTO_DISMISS_MS = 6000;

/**
 * Wrap the app once (in the root layout); any page can then call
 * `useFlash().success("Product created")`. Every alert has a close button.
 */
export function FlashProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<FlashMessage[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setMessages((all) => all.filter((m) => m.id !== id));
  }, []);

  const push = useCallback(
    (kind: FlashKind, message: string) => {
      const id = nextId.current++;
      setMessages((all) => [...all, { id, kind, message }]);
      if (kind !== "error") setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const api = useMemo<FlashApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <FlashContext.Provider value={api}>
      {children}
      <div className="mms-flash-stack" aria-live="polite">
        {messages.map((m) => (
          <Alert key={m.id} kind={m.kind} onDismiss={() => dismiss(m.id)}>
            {m.message}
          </Alert>
        ))}
      </div>
    </FlashContext.Provider>
  );
}

export function useFlash(): FlashApi {
  const api = useContext(FlashContext);
  if (!api) throw new Error("useFlash must be used inside <FlashProvider>");
  return api;
}

/** Inline alert; also what the flash stack renders. */
export function Alert({
  kind,
  children,
  onDismiss,
}: {
  kind: FlashKind;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className={`mms-alert ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span className="mms-alert-text">{children}</span>
      {onDismiss && (
        <button type="button" className="mms-icon-btn" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}
