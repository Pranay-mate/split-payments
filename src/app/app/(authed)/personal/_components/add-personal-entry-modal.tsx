"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  AddPersonalEntry,
  type EditingPersonalEntry,
} from "./add-personal-entry";

/**
 * Modal wrapper around <AddPersonalEntry />. Same chrome pattern as
 * AddExpenseModal — backdrop, portal, bottom-sheet on mobile, centered
 * card on desktop. Removes the dashboard's surrounding noise so the
 * user can focus on logging the entry.
 */
export function AddPersonalEntryModal({
  open,
  onClose,
  editing,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  editing?: EditingPersonalEntry | null;
  onSubmitted: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const isEditing = Boolean(editing);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? "Edit entry" : "Add entry"}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-5 py-5 text-white sm:px-6">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-white/85">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {isEditing ? "Edit" : "New"}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            {isEditing ? "Edit entry" : "Add entry"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 sm:px-6">
          <AddPersonalEntry
            key={editing?.id ?? "new"}
            editing={editing ?? null}
            onDone={() => {
              onSubmitted();
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
