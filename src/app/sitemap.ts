import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: { path: string; changeFrequency: "weekly" | "monthly"; priority: number }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/calculators/split-bill", changeFrequency: "monthly", priority: 0.85 },
  ];

  return routes.map((r) => ({
    url: absoluteUrl(r.path),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
