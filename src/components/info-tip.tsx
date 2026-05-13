"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HelpCircle, Info } from "lucide-react";

/**
 * Surgical info-disclosure helper. Use it for terms a first-time user
 * genuinely won't know (scorecard pillars, Indian tax sections, opaque
 * toggles), NOT for every form field — that's noise.
 *
 * Behaviour:
 *   - Tap-only on both mobile + desktop (more reliable than hover-on-
 *     desktop, since the same component shouldn't render two different
 *     interaction models)
 *   - Click outside or Esc to close
 *   - Popover positions below the trigger by default; flips above if
 *     there's no room (smart-edge detection on first paint)
 *   - Trigger sizes itself to the surrounding text (`align-baseline`)
 *
 * Three visual variants — pick by where it lives:
 *   - "muted"  → inline next to a stat or label (the default)
 *   - "pill"   → small "?" pill, good for toggles where you want it to
 *                be obviously tappable
 *   - "header" → larger, with a "Help" word — for section headers
 */

type Variant = "muted" | "pill" | "header";

export function InfoTip({
  label,
  children,
  variant = "muted",
  className = "",
}: {
  /** Screen-reader label + aria-describedby target. Short, e.g.
   *  "About the Emergency pillar". */
  label: string;
  /** Body content of the popover. Plain text or simple JSX (paragraphs,
   *  lists). Keep it under ~3 short lines — anything longer belongs in
   *  a help page, not a popover. */
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const [flipRight, setFlipRight] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  // Popover width (must match the class below). Used for horizontal-
  // overflow detection.
  const POPOVER_WIDTH_PX = 256;
  const SAFE_MARGIN_PX = 16;

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Smart-flip: if there isn't enough room below or to the right,
  // anchor above / right-aligned. Measure on open, then leave alone —
  // re-measuring on scroll would feel jittery.
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceRight = window.innerWidth - rect.left;
    queueMicrotask(() => {
      setFlipUp(spaceBelow < 180);
      // If the popover (left-anchored at the trigger) would overflow
      // the right edge of the viewport, swap to right-anchored so it
      // grows leftward instead.
      setFlipRight(spaceRight < POPOVER_WIDTH_PX + SAFE_MARGIN_PX);
    });
  }, [open]);

  const triggerClass =
    variant === "pill"
      ? "inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 transition hover:border-slate-500 hover:text-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400 dark:hover:text-slate-200"
      : variant === "header"
        ? "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        : "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center align-baseline text-slate-400 transition hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200";

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-baseline ${className}`}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={triggerClass}
      >
        {variant === "pill" ? (
          "?"
        ) : variant === "header" ? (
          <>
            <HelpCircle className="h-3.5 w-3.5" aria-hidden /> Help
          </>
        ) : (
          <Info className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          id={id}
          role="tooltip"
          className={`absolute z-50 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-[11.5px] leading-relaxed text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${
            flipUp ? "bottom-full mb-2" : "top-full mt-2"
          } ${flipRight ? "right-0" : "left-0"}`}
          // Stop event propagation so clicking inside the popover
          // (e.g. selecting text) doesn't bubble up to close-listeners.
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </span>
  );
}
