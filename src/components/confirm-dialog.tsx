"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

/**
 * Branded confirm dialog — replaces native `confirm()` everywhere.
 *
 * Native `window.confirm()` prefixes the message with "<domain> says..."
 * on every desktop browser. For a finance product this reads as untrusted
 * and amateurish. This portal-based dialog matches the app's visual
 * language (gradient header, rose accent for destructive actions,
 * iOS-safe-area-aware) and returns a promise just like `confirm()` so
 * call sites convert mechanically:
 *
 *   - Before:  if (!confirm("Remove this?")) return;
 *   - After:   if (!(await confirm({ title: "Remove this?", destructive: true }))) return;
 */

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive action — confirm button renders in rose, header icon
   *  shows a warning triangle. Use for delete / archive / leave flows. */
  destructive?: boolean;
};

type Pending = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(
  null,
);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus the confirm button when the dialog opens so Enter triggers it.
  // queueMicrotask defer because we need the button to exist in the DOM.
  useEffect(() => {
    if (!pending) return;
    queueMicrotask(() => confirmButtonRef.current?.focus());
  }, [pending]);

  // Escape = cancel.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pending.resolve(false);
        setPending(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    [],
  );

  const onCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };
  const onConfirm = () => {
    pending?.resolve(true);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              onClick={onCancel}
            >
              <div
                className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={onCancel}
                  aria-label="Close"
                  className="absolute right-2.5 top-2.5 z-10 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>

                <div className="p-5">
                  <div className="flex items-start gap-3">
                    {pending.options.destructive ? (
                      <span
                        aria-hidden
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden />
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1 pr-6">
                      <h2
                        id="confirm-dialog-title"
                        className="text-base font-semibold tracking-tight"
                      >
                        {pending.options.title}
                      </h2>
                      {pending.options.description && (
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                          {pending.options.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {pending.options.cancelLabel ?? "Cancel"}
                    </button>
                    <button
                      ref={confirmButtonRef}
                      type="button"
                      onClick={onConfirm}
                      className={`rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition ${
                        pending.options.destructive
                          ? "bg-rose-600 hover:bg-rose-500"
                          : "bg-indigo-600 hover:bg-indigo-500"
                      }`}
                    >
                      {pending.options.confirmLabel ?? "Confirm"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error(
      "useConfirm must be used inside <ConfirmProvider /> — wrap the app root in src/app/layout.tsx.",
    );
  }
  return ctx;
}
