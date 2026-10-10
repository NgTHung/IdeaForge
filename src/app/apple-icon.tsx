import { ImageResponse } from "next/og";
import { brandIconSvg } from "@/features/brand/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds home-screen icons itself, so this one is square.
export default function AppleIcon() {
  const src = `data:image/svg+xml,${encodeURIComponent(brandIconSvg({ rounded: false }))}`;
  return new ImageResponse(<img src={src} width={size.width} height={size.height} alt="" />, size);
}
