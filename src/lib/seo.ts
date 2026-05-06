import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";

type BuildMetadataInput = {
  title: string;
  description: string;
  /** Path under origin, e.g. "/calculators/split-bill". */
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function buildMetadata({
  title,
  description,
  path,
  keywords,
  noIndex,
}: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.ogLocale,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
