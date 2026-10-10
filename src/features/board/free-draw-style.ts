export const defaultFreeDrawWidth = 3.2;

export function freeDrawColor(value: string | undefined, fallback: string) {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

export function freeDrawWidth(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(12, Math.max(1, value)) : defaultFreeDrawWidth;
}
