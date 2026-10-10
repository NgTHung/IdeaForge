"use client";

import { useEffect, useRef, useState } from "react";
import { AchievementList } from "./board-activity";
import { BoardIcon } from "./board-icons";
import type { StickerKind } from "./board-social-contract";
import type { earnedAchievements } from "./personalization";
import { StickerPalette } from "./sticker-decorations";

export function DecorateMenu({ achievements, canWrite, onPlace, onReact, onMessage }: {
  achievements: ReturnType<typeof earnedAchievements>; canWrite: boolean;
  onPlace: (kind: StickerKind) => void; onReact: (point: { x: number; y: number } | undefined) => void; onMessage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>(".board-decorate-menu button:not(:disabled)")?.focus();
    const keyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    const pointerDown = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("pointerdown", pointerDown);
    return () => { document.removeEventListener("keydown", keyDown, true); document.removeEventListener("pointerdown", pointerDown); };
  }, [open]);
  function place(kind: StickerKind) { setOpen(false); onPlace(kind); }
  return <div ref={root} className="board-decorate">
    <button ref={trigger} type="button" className={`board-tool ${open ? "active" : ""}`} aria-label="Decorate" title="Stickers, achievements, and reactions"
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span className="board-tool-icon"><BoardIcon name="decorate" /></span></button>
    {open && <section className="board-decorate-menu" role="dialog" aria-label="Decorate">
      <h2>Stickers</h2>
      <StickerPalette canWrite={canWrite} onPlace={place} />
      <h2>Achievements <small>{achievements.length}/3</small></h2>
      <AchievementList achievements={achievements} canWrite={canWrite} onPlace={place} />
      <h2>Reactions</h2>
      <div className="board-decorate-reactions">
        <button type="button" aria-keyshortcuts="R" onClick={(event) => { setOpen(false); onReact(event.detail ? { x: event.clientX, y: event.clientY } : undefined); }}>React <kbd>R</kbd></button>
        <button type="button" aria-keyshortcuts="Enter" onClick={() => { setOpen(false); onMessage(); }}>Message <kbd>Enter</kbd></button>
      </div>
      {!canWrite && <p>Only editors can place stickers.</p>}
    </section>}
  </div>;
}
