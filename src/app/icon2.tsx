import { ImageResponse } from "next/og";
import { brandIconJSX } from "@/lib/brand-icon";

/** PWA maskable icon — 512×512, content fits Android adaptive-icon
 *  safe zone (inner 80 %). */

export const dynamic = "force-static";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon2() {
  return new ImageResponse(brandIconJSX(512, true), { ...size });
}
