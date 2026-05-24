"use client";

import { useEffect } from "react";

/**
 * Suppresses Android Chrome's long-press image-preview overlay
 * on chart SVGs.
 *
 * The earlier pure-CSS attempt (`-webkit-touch-callout: none`)
 * only works on iOS Safari — on Android Chrome the preview comes
 * from the same path that fires `contextmenu`, so we catch that
 * event at the document level and preventDefault when the target
 * sits inside a chart container. Recharts auto-adds
 * `.recharts-wrapper`; the `.no-callout` opt-in is for any
 * hand-rolled SVG (e.g. the settlement progress ring).
 *
 * Listener is delegated rather than per-chart so we don't have to
 * wire onContextMenu onto every <ResponsiveContainer> across the
 * app. Capture-phase isn't needed — the default action fires
 * after the event bubbles up if no handler stopped it.
 */
export function ChartCalloutGuard() {
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest(".recharts-wrapper, .no-callout")) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  return null;
}
