import { ImageResponse } from "next/og";
import { brandIconJSX } from "@/lib/brand-icon";

/** iOS home-screen icon — 180×180. iOS adds rounded corners itself. */

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(brandIconJSX(180, false), { ...size });
}
