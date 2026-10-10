"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ViewportPortal } from "@xyflow/react";
import { achievementLabels, achievementLedgerSchema, advanceMilestones, defaultPreferences, earnedAchievements, emptyLedger, reachedMilestones, recordContribution, type AchievementLedger, type EffectKind, type Personalization } from "./personalization";
import { stickerCatalog, type StickerKind } from "./board-social-contract";
import type { Board } from "./model";

export const AnimationContext = createContext({ preferences: defaultPreferences, motion: false });
export type ConnectedMember = { id: string; name: string };
type Activity = { id: number; kind: EffectKind; message: string; ideaId?: string };
function loadLedger(key: string): AchievementLedger {
  try { return achievementLedgerSchema.parse(JSON.parse(window.localStorage.getItem(key) ?? "null")); } catch { return emptyLedger; }
}
export function useBoardActivity(board: Board, members: ConnectedMember[], scope: string, userId: string, preferences: Personalization) {
  const ledgerKey = `ideaforge-achievements-v1:${scope}:${userId}`;
  const [ledger, setLedger] = useState<AchievementLedger>(emptyLedger);
  const ledgerRef = useRef<AchievementLedger>(emptyLedger);
  const loaded = useRef<string | null>(null);
  const [events, setEvents] = useState<Activity[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);
  const preferencesRef = useRef(preferences);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);
  useEffect(() => {
    loaded.current = ledgerKey;
    ledgerRef.current = loadLedger(ledgerKey);
    const frame = requestAnimationFrame(() => setLedger(ledgerRef.current));
    const pendingTimers = timers.current;
    return () => { cancelAnimationFrame(frame); for (const timer of pendingTimers) clearTimeout(timer); pendingTimers.clear(); };
  }, [ledgerKey]);
  const notify = useCallback((kind: EffectKind, message: string, ideaId?: string) => {
    if (!preferencesRef.current.effects[kind]) return;
    const id = ++sequence.current;
    setEvents((current) => [...current.slice(-3), { id, kind, message, ideaId }]);
    const timer = setTimeout(() => { setEvents((current) => current.filter((item) => item.id !== id)); timers.current.delete(timer); }, 2600);
    timers.current.add(timer);
  }, []);
  const record = useCallback((ideaId: string, current: Board, sources?: string[]) => {
    if (loaded.current !== ledgerKey) { ledgerRef.current = loadLedger(ledgerKey); loaded.current = ledgerKey; }
    const before = earnedAchievements(ledgerRef.current);
    const next = recordContribution(ledgerRef.current, ideaId, current, sources);
    ledgerRef.current = next;
    setLedger(next);
    try { window.localStorage.setItem(ledgerKey, JSON.stringify(next)); } catch { /* Earned stickers remain available for this session. */ }
    for (const achievement of earnedAchievements(next)) {
      if (!before.includes(achievement)) notify("achievement", `Sticker earned: ${achievementLabels[achievement]}`);
    }
  }, [ledgerKey, notify]);
  const milestones = useRef(reachedMilestones(board));
  const seenMembers = useRef(new Set(members.map((member) => member.id)));
  useEffect(() => {
    const next = advanceMilestones(board, milestones.current);
    milestones.current = next.reached;
    for (const milestone of next.celebrate) notify("milestone", milestone === "ten" ? "Ten ideas! Your brainstorm is growing." : "First merge! A new concept takes root.");
    for (const member of members) {
      if (!seenMembers.current.has(member.id)) { seenMembers.current.add(member.id); notify("entrance", `${member.name} has arrived!`); }
    }
  }, [board, members, notify]);
  return { events, notify, record, achievements: earnedAchievements(ledger) };
}
function ActivityGlyph({ kind, preferences }: { kind: EffectKind; preferences: Personalization }) {
  if (kind === "merge") return <span className="merge-sparks"><span className="merge-spark-core">✦</span>{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--spark-angle": `${index * 30}deg`, "--spark-delay": `${index % 3 * 70}ms` } as React.CSSProperties}>✧</i>)}</span>;
  const glyphs: Record<EffectKind, string> = {
    merge: "", vote: preferences.reaction === "cat" ? "😻" : preferences.reaction === "frog" ? "🐸" : "♥",
    entrance: "🪂", thinking: "", undo: "⏪", milestone: preferences.milestone === "ducks" ? "🦆 🦆 🦆" : "🎉 ✨ 🎊",
    achievement: "🏅", share: "🕊️ ✉️",
  };
  return <span>{glyphs[kind]}</span>;
}
export function BoardActivity({ activity, board, positions }: { activity: ReturnType<typeof useBoardActivity>; board: Board; positions: Record<string, { x: number; y: number }> }) {
  const { preferences, motion } = useContext(AnimationContext);
  return <>
    <div className="board-activity-notices" aria-live="polite" aria-atomic="false">
      {activity.events.map((event) => <div key={event.id} className="board-activity-notice" data-effect={event.kind}>
        {motion && <span className="activity-glyph" aria-hidden="true"><ActivityGlyph kind={event.kind} preferences={preferences} /></span>}<span>{event.message}</span>
      </div>)}
    </div>
    <ViewportPortal><div className="board-activity-anchors" aria-hidden="true">{motion && activity.events.filter((event) => event.ideaId).map((event) => {
      const idea = board.ideas.find((item) => item.id === event.ideaId);
      if (!idea) return null;
      const position = positions[idea.id] ?? idea.position;
      return <span key={event.id} className="activity-anchor" data-effect={event.kind} style={{ left: position.x + 230, top: position.y + 80 }}><ActivityGlyph kind={event.kind} preferences={preferences} /></span>;
    })}</div></ViewportPortal>
  </>;
}
export function AchievementCollection({ achievements, canWrite, onPlace }: { achievements: ReturnType<typeof earnedAchievements>; canWrite: boolean; onPlace: (kind: StickerKind) => void }) {
  return <aside className="board-achievements" aria-label="Achievements">
    <details className="achievement-collection"><summary><span aria-hidden="true">🏅</span> Achievements <b>{achievements.length}/3</b>
      <span className="earned-badges" aria-hidden="true">{achievements.map((key) => <span key={key}>{stickerCatalog[key].glyph}</span>)}</span></summary>
      <div className="achievement-popup"><strong>Your achievements</strong><ul>
        {Object.entries(achievementLabels).map(([key, label]) => {
          const earned = achievements.includes(key as keyof typeof achievementLabels);
          return <li key={key} data-earned={earned}><span aria-hidden="true">{stickerCatalog[key as StickerKind].glyph}</span><div><b>{label}</b><small>{key === "spark" ? "Save your first idea" : key === "combo" ? "Keep a merge across groups" : "Save five ideas"}</small><span className="achievement-state">{earned ? "Earned" : "Not earned yet"}</span>
            {earned && <button type="button" disabled={!canWrite} aria-label={`Place ${label} achievement sticker`} onClick={(event) => { onPlace(key as StickerKind); event.currentTarget.closest("details")?.removeAttribute("open"); }}>Place sticker ↗</button>}</div></li>;
        })}
      </ul><p>Awards stay in this browser for you and this board. Placed stickers are shared and saved.</p></div>
    </details>
  </aside>;
}
export function ThinkingAnimation() {
  const { preferences, motion } = useContext(AnimationContext);
  if (!preferences.effects.thinking) return null;
  return <span className="thinking-animation" data-style={preferences.thinking} aria-hidden="true">{motion ? <span>{preferences.thinking === "hamster" ? "🐹" : preferences.thinking === "cat" ? "🐈" : "⚗️"}</span> : <span>✦</span>}</span>;
}
