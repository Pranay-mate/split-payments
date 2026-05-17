import type { Metadata } from "next";
import { ImportFlow } from "./_components/import-flow";

export const metadata: Metadata = {
  title: "Import from bank · EasySplits",
  robots: { index: false, follow: false },
};

/**
 * Bank-statement CSV import. Pure client-side parsing — the file never
 * touches our servers. Only the rows the user explicitly confirms are
 * sent through the existing personal.create tRPC mutation (one call per
 * row with concurrency 4) using a deterministic clientEventId so
 * re-uploads dedup transparently.
 */
export default function ImportPage() {
  return <ImportFlow />;
}
