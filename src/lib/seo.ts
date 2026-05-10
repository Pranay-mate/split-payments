import type { Metadata } from "next";
import { SITE, absoluteUrl } from "./site";

type BuildMetadataInput = {
  title: string;
  description: string;
  /** Path under origin, e.g. "/calculators/split-bill". */
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  /** Absolute or absolute-pathed URL of an OG image (1200×630 ideal).
   *  Used for both openGraph.images and twitter.images so link previews
   *  render rich cards on every platform. */
  image?: string;
};

export function buildMetadata({
  title,
  description,
  path,
  keywords,
  noIndex,
  image,
}: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = image
    ? image.startsWith("http")
      ? image
      : absoluteUrl(image)
    : undefined;
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
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
