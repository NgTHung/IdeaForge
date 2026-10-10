// The IdeaForge mark: two ideas flow together into one spark.
// The app header, the favicon, and the apple icon all draw from this geometry.

const VIEW_BOX = "0 0 64 64";
const STEMS = "M18 17C18 29 32 26 32 36M46 17C46 29 32 26 32 36";
const NODES = [[18, 16], [46, 16]] as const;
const NODE_RADIUS = 6.5;
const STEM_WIDTH = 5.5;
const SPARK = "M32 30Q32 44.5 46.5 44.5Q32 44.5 32 59Q32 44.5 17.5 44.5Q32 44.5 32 30Z";

export const BRAND_COLORS = { tile: "#16785f", ideas: "#fff", spark: "#f6c453", sparkOnLight: "#e9a91f" } as const;

type BrandMarkProps = {
  className?: string;
  // "tile" draws the white-and-gold mark on the green app tile. "bare" draws the mark alone,
  // with the ideas in currentColor so the surrounding text color sets them.
  variant?: "tile" | "bare";
};

export function BrandMark({ className, variant = "tile" }: BrandMarkProps) {
  const tile = variant === "tile";
  const ideas = tile ? BRAND_COLORS.ideas : "currentColor";
  return <svg className={className} viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
    {tile && <rect width="64" height="64" rx="15" fill={BRAND_COLORS.tile} />}
    <path d={STEMS} fill="none" stroke={ideas} strokeWidth={STEM_WIDTH} strokeLinecap="round" />
    {NODES.map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r={NODE_RADIUS} fill={ideas} />)}
    <path d={SPARK} fill={tile ? BRAND_COLORS.spark : BRAND_COLORS.sparkOnLight} />
  </svg>;
}

// Standalone SVG document of the tiled mark, for icon routes. Set `rounded` to false for
// platforms that apply their own mask, such as the iOS home screen.
export function brandIconSvg({ rounded = true }: { rounded?: boolean } = {}) {
  const nodes = NODES.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${NODE_RADIUS}" fill="${BRAND_COLORS.ideas}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}">`
    + `<rect width="64" height="64" rx="${rounded ? 15 : 0}" fill="${BRAND_COLORS.tile}"/>`
    + `<path d="${STEMS}" fill="none" stroke="${BRAND_COLORS.ideas}" stroke-width="${STEM_WIDTH}" stroke-linecap="round"/>`
    + nodes
    + `<path d="${SPARK}" fill="${BRAND_COLORS.spark}"/>`
    + "</svg>";
}
