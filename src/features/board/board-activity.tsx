"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ViewportPortal } from "@xyflow/react";
import { achievementLabels, achievementLedgerSchema, advanceMilestones, defaultPreferences, earnedAchievements, emptyLedger, reachedMilestones, recordContribution, type AchievementLedger, type EffectKind, type Personalization } from "./personalization";
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
  const loaded = useRef(false);
  const [events, setEvents] = useState<Activity[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);
  const preferencesRef = useRef(preferences);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);
  useEffect(() => {
    loaded.current = true;
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
    if (!loaded.current) ledgerRef.current = loadLedger(ledgerKey);
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
  if (kind === "merge") return <span className="activity-merge"><span>🐱</span><span>🐱</span><span>✨</span></span>;
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
export function AchievementCollection({ achievements }: { achievements: ReturnType<typeof earnedAchievements> }) {
  const { preferences } = useContext(AnimationContext);
  return <aside className="board-achievements" aria-label="Achievement stickers">
    {preferences.effects.achievement && <details className="achievement-collection"><summary>Stickers · {achievements.length}/3</summary><ul>
      {Object.entries(achievementLabels).map(([key, label]) => <li key={key} data-earned={achievements.includes(key as keyof typeof achievementLabels)}><span aria-hidden="true">{achievements.includes(key as keyof typeof achievementLabels) ? "★" : "☆"}</span><span>{label}<small>{key === "spark" ? "Save your first idea" : key === "combo" ? "Keep a merge across clusters" : "Save five ideas"}</small></span></li>)}
    </ul><p>Saved for you and this board in this browser.</p></details>}
  </aside>;
}
export function ThinkingAnimation() {
  const { preferences, motion } = useContext(AnimationContext);
  if (!preferences.effects.thinking) return null;
  return <span className="thinking-animation" data-style={preferences.thinking} aria-hidden="true">{motion ? <span>{preferences.thinking === "hamster" ? "🐹" : preferences.thinking === "cat" ? "🐈" : "⚗️"}</span> : <span>✦</span>}</span>;
}
