import { ImageResponse } from "next/og";
import { brandIconJSX } from "@/lib/brand-icon";

/** PWA large icon — 512×512, standard purpose. */

export const dynamic = "force-static";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon0() {
  return new ImageResponse(brandIconJSX(512, false), { ...size });
}
