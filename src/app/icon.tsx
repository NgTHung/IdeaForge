import { brandIconSvg } from "@/features/brand/brand-mark";

export const contentType = "image/svg+xml";

export default function Icon() {
  return new Response(brandIconSvg(), { headers: { "Content-Type": contentType } });
}
