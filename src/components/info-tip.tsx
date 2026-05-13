"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HelpCircle, Info } from "lucide-react";

/**
 * Surgical info-disclosure helper. Use it for terms a first-time user
 * genuinely won't know (scorecard pillars, Indian tax sections, opaque
 * toggles), NOT for every form field — that's noise.
 *
 * Positioning: the popover renders with `position: fixed` and we compute
 * a viewport-clamped (left, top) on open. That way the popover always
 * fits in the viewport regardless of where the trigger sits — earlier
 * versions of this anchored to `left: 0` or `right: 0` of the trigger,
 * which overflowed for triggers in the middle of mobile screens.
 *
 * Three visual variants — pick by where it lives:
 *   - "muted"  → inline next to a stat or label (the default)
 *   - "pill"   → small "?" pill, good for toggles where you want it to
 *                be obviously tappable
 *   - "header" → larger, with a "Help" word — for section headers
 */

type Variant = "muted" | "pill" | "header";

const POPOVER_WIDTH_PX = 256;
const POPOVER_APPROX_HEIGHT_PX = 160;
const SAFE_MARGIN_PX = 12;

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
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const id = useId();

  // Close on outside click or Escape. Also close on scroll — the
  // fixed-positioned popover would otherwise hang in place while the
  // anchor scrolled away from under it.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open]);

  // Compute clamped viewport position on open. `position: fixed` plus
  // hard-clamped (left, top) means the popover NEVER overflows the
  // viewport, no matter where the trigger lives.
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POPOVER_WIDTH_PX, vw - SAFE_MARGIN_PX * 2);
    // Center on the trigger horizontally, then clamp into viewport.
    const idealLeft =
      rect.left + rect.width / 2 - width / 2;
    const left = Math.max(
      SAFE_MARGIN_PX,
      Math.min(idealLeft, vw - width - SAFE_MARGIN_PX),
    );
    // Prefer below the trigger; flip above when there's no room.
    const spaceBelow = vh - rect.bottom;
    const top =
      spaceBelow >= POPOVER_APPROX_HEIGHT_PX
        ? rect.bottom + 8
        : Math.max(SAFE_MARGIN_PX, rect.top - POPOVER_APPROX_HEIGHT_PX - 8);
    queueMicrotask(() => setPos({ left, top }));
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

      {open && pos && (
        <div
          id={id}
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            width: `min(${POPOVER_WIDTH_PX}px, calc(100vw - ${SAFE_MARGIN_PX * 2}px))`,
          }}
          className="z-50 rounded-xl border border-slate-200 bg-white p-3 text-[11.5px] leading-relaxed text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </span>
  );
}
