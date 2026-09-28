"use client";

import { ReactNode, useEffect, useRef } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons row; rendered right-aligned under the body. */
  footer?: ReactNode;
}

/**
 * Built on the native <dialog>, which already traps focus, closes on Esc
 * and renders above everything else.
 */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="mms-modal"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click that lands on the dialog element itself is on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="mms-modal-body">
          <div className="mms-modal-header">
            <h3>{title}</h3>
            <button type="button" className="mms-icon-btn" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
          {children}
          {footer && <div className="mms-modal-footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
