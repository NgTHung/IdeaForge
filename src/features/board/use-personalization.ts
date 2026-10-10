"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parsePreferences, type Personalization } from "./personalization";

const key = "ideaforge-personalization-v1";
const eventName = "ideaforge-personalization-change";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); };
}
let memory: string | null = null;
function snapshot() {
  try { return window.localStorage.getItem(key) ?? memory ?? JSON.stringify(parsePreferences(null, window.localStorage.getItem("ideaforge-theme"))); }
  catch { return memory; }
}
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
export function usePersonalization() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const preferences = useMemo(() => parsePreferences(raw), [raw]);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const update = useCallback((patch: Partial<Personalization>) => {
    const next = { ...parsePreferences(snapshot()), ...patch };
    memory = JSON.stringify(next);
    try { window.localStorage.setItem(key, memory); window.localStorage.setItem("ideaforge-theme", next.theme); } catch { /* Settings still work when browser storage is unavailable. */ }
    window.dispatchEvent(new Event(eventName));
  }, []);
  return { preferences, update, motion: preferences.animations && !reducedMotion, reducedMotion };
}
