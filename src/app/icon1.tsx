import { ImageResponse } from "next/og";
import { brandIconJSX } from "@/lib/brand-icon";

/** PWA maskable icon — 192×192, content fits Android adaptive-icon
 *  safe zone (inner 80 %). */

export const dynamic = "force-static";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon1() {
  return new ImageResponse(brandIconJSX(192, true), { ...size });
}
