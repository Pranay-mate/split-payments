/**
 * In-app brand badge — renders the same v2.6 "gradient sweep donut + ₹"
 * design as the favicon / PWA icon, in pure CSS so it stays sharp at
 * any size and respects dark-mode container chrome.
 *
 * Caller controls the outer size via the `className` prop (e.g.
 * `h-8 w-8`); the donut + glyph scale to that frame.
 */
export function BrandMark({
  className = "h-8 w-8",
  rounded = "rounded-lg",
  fontSizeClass = "text-[11px]",
}: {
  className?: string;
  rounded?: string;
  /** Tailwind text-* class — controls the ₹ size relative to the
   *  badge. Tune per use-site (text-[10px] for 8px, text-base for 48px). */
  fontSizeClass?: string;
}) {
  return (
    <span
      aria-hidden
      className={`relative grid place-items-center overflow-hidden bg-slate-900 ${rounded} ${className}`}
    >
      <span
        className="grid place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-indigo-500"
        style={{ width: "72%", height: "72%" }}
      >
        <span
          className={`grid place-items-center rounded-full bg-slate-900 font-bold text-white ${fontSizeClass}`}
          style={{ width: "62%", height: "62%", lineHeight: 1 }}
        >
          ₹
        </span>
      </span>
    </span>
  );
}
