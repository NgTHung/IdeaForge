import { LiveMap, LiveObject, type LsonObject } from "@liveblocks/client";

export function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function updateFields<T extends LsonObject>(target: LiveObject<T>, next: T): boolean {
  const current = target.toJSON() as Record<string, unknown>;
  const updated = next as Record<string, unknown>;
  let changed = false;
  for (const key of new Set([...Object.keys(current), ...Object.keys(updated)])) {
    const before = current[key];
    const after = updated[key];
    if (sameValue(before, after)) continue;
    changed = true;
    if (after === undefined) target.delete(key as keyof T);
    else target.set(key as keyof T, after as T[keyof T]);
  }
  return changed;
}

export function syncObjectMap<T extends LsonObject & { id: string }>(saved: LiveMap<string, LiveObject<T>>, items: T[]): boolean {
  const next = new Map(items.map((item) => [item.id, item]));
  let changed = false;
  for (const [id, object] of saved.entries()) {
    const updated = next.get(id);
    if (!updated) { saved.delete(id); changed = true; }
    else { changed = updateFields(object, updated) || changed; next.delete(id); }
  }
  for (const item of next.values()) { saved.set(item.id, new LiveObject(item)); changed = true; }
  return changed;
}
