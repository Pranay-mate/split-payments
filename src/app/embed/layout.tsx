/**
 * Minimal layout for iframe-embedded routes — overrides the root
 * layout to skip SiteHeader, footer, install prompt, offline indicator,
 * etc. Embedders get a clean rectangle of brand-colored content with
 * no chrome they didn't ask for.
 *
 * Routes under /embed/* render bare <body> + the page itself. SEO
 * doesn't matter (these are noindex anyway via per-page metadata).
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        margin: 0,
        padding: 0,
        // Iframe wraps this; we want zero chrome around it.
      }}
    >
      {children}
    </div>
  );
}
