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
    const inChart = (target: EventTarget | null): boolean => {
      const el = target as Element | null;
      return Boolean(el?.closest?.(".recharts-wrapper, .no-callout"));
    };

    const onContextMenu = (e: Event) => {
      if (inChart(e.target)) e.preventDefault();
    };
    // Chrome's image-action gesture on Android can also initiate a
    // dragstart (the same path that powers "Search image with Lens").
    // preventDefault stops the drag preview which is the white-box
    // overlay the user reported.
    const onDragStart = (e: Event) => {
      if (inChart(e.target)) e.preventDefault();
    };
    // Some Android Chrome builds use a touch-and-hold gesture that
    // never fires `contextmenu` — fall back to canceling the long-
    // press at the touchstart layer when the target is a chart.
    // Passive must be false to allow preventDefault.
    const onTouchStart = (e: TouchEvent) => {
      if (inChart(e.target)) {
        // Don't blanket-block taps; only stop the gesture if it
        // looks like a long-press candidate (single finger). Multi-
        // touch (pinch-zoom etc.) is left alone.
        if (e.touches.length === 1) {
          // We don't preventDefault here (would kill tooltip taps);
          // instead just stop propagation so the document-level
          // image-lookup listener Chrome registers internally
          // doesn't see the event. Lightweight belt to the
          // contextmenu/dragstart suspenders above.
          e.stopPropagation();
        }
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return null;
}
