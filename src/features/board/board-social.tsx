"use client";

import { useCallback, useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { useViewport, ViewportPortal } from "@xyflow/react";
import { AnimationContext } from "./board-activity";
import { appendSignal, reactions, type NamedSignal, type SocialSignal } from "./board-social-contract";
import { reactionShortcut, signalPosition, type CanvasPoint } from "./canvas-interaction";
import { createIdeaId } from "./id";

export function useSignalQueue() {
  const [signals, setSignals] = useState<NamedSignal[]>([]);
  const append = useCallback((signal: NamedSignal) => setSignals((current) => appendSignal(current, signal, Date.now())), []);
  useEffect(() => {
    if (!signals.length) return;
    const timer = window.setTimeout(() => setSignals((current) => current.filter((item) => item.expiresAt > Date.now())), Math.max(0, Math.min(...signals.map((item) => item.expiresAt)) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [signals]);
  return { signals, append };
}
export function CursorSignals({ signals, positions }: { signals: NamedSignal[]; positions: Record<number, CanvasPoint> }) {
  const { zoom } = useViewport();
  const { motion } = useContext(AnimationContext);
  return <ViewportPortal><div className="cursor-signals" aria-live="polite">
    {signals.map((signal) => { const point = signalPosition(signal, positions); return <div key={`${signal.connectionId}:${signal.id}`} className={`cursor-signal ${motion ? "has-motion" : ""}`} data-kind={signal.kind}
      style={{ left: point.x, top: point.y, transform: `scale(${1 / zoom}) translate(18px, -20px)`, transformOrigin: "top left" }}>
      <span>{signal.kind === "reaction" ? reactions[signal.value] : signal.value}</span><small>{signal.name}</small>
    </div>; })}
  </div></ViewportPortal>;
}
export function SocialControls({ chatOpen, setChatOpen, position, screenPosition, pointerPosition, onSend, onClose, shortcutsBlocked }: {
  shortcutsBlocked: boolean; chatOpen: boolean; setChatOpen: (value: boolean) => void; position: () => { x: number; y: number };
  screenPosition: CanvasPoint | null; pointerPosition: () => CanvasPoint | null; onSend: (signal: SocialSignal) => void; onClose: () => void;
}) {
  const [wheelAnchor, setWheelAnchor] = useState<CanvasPoint | null>(null);
  const wheelOpen = wheelAnchor !== null;
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const reactionTrigger = useRef<HTMLButtonElement>(null);
  const lastSent = useRef(0);
  const toggleWheel = useCallback((point?: CanvasPoint) => {
    const bounds = root.current?.parentElement?.getBoundingClientRect();
    const triggerBounds = reactionTrigger.current?.getBoundingClientRect();
    if (!bounds || !triggerBounds) return;
    const anchor = point ?? pointerPosition() ?? { x: triggerBounds.left + triggerBounds.width / 2, y: triggerBounds.top + triggerBounds.height / 2 };
    setWheelAnchor((current) => current ? null : { x: anchor.x - bounds.left, y: anchor.y - bounds.top });
    setChatOpen(false);
  }, [pointerPosition, setChatOpen]);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const blocked = shortcutsBlocked || Boolean(target?.closest("input,textarea,select,[role='dialog'],[contenteditable]:not([contenteditable='false'])"));
      if (event.defaultPrevented || !reactionShortcut({ key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey, isComposing: event.isComposing, repeat: event.repeat, blocked })) return;
      event.preventDefault(); toggleWheel();
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [toggleWheel, shortcutsBlocked]);
  useEffect(() => { if (chatOpen) input.current?.focus(); }, [chatOpen]);
  useEffect(() => {
    if (!wheelOpen) return;
    wheel.current?.querySelector<HTMLButtonElement>(".reaction-option")?.focus();
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target) && !wheel.current?.contains(event.target)) setWheelAnchor(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [wheelOpen]);
  const send = useCallback((signal: SocialSignal) => {
    if (Date.now() - lastSent.current < 300) return;
    lastSent.current = Date.now(); onSend(signal);
  }, [onSend]);
  return <>
    <div className="board-social-controls" ref={root}>
      <button ref={reactionTrigger} type="button" aria-label="Quick reactions" title="Quick reactions (R)" aria-keyshortcuts="R" aria-expanded={wheelOpen} onClick={(event) => toggleWheel(event.detail ? { x: event.clientX, y: event.clientY } : undefined)}>☺ <span>React</span><kbd>R</kbd></button>
      <button type="button" aria-label="Cursor chat" title="Cursor chat (Enter)" onClick={() => { setWheelAnchor(null); setChatOpen(!chatOpen); }}>◌ <span>Chat</span><kbd>↵</kbd></button>
    </div>
    {wheelAnchor && <div ref={wheel} className="reaction-wheel" role="dialog" aria-label="Choose a reaction"
      style={{ left: `clamp(var(--wheel-inset), ${wheelAnchor.x}px, calc(100% - var(--wheel-inset)))`, top: `clamp(var(--wheel-inset), ${wheelAnchor.y}px, calc(100% - var(--wheel-inset)))` }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); setWheelAnchor(null); reactionTrigger.current?.focus(); }
        if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault(); const choices = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
          const index = choices.indexOf(document.activeElement as HTMLButtonElement);
          choices[(index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + choices.length) % choices.length]?.focus();
        }
      }}><span className="reaction-wheel-center" aria-hidden="true">✦</span>{Object.entries(reactions).map(([key, glyph], index) => <button type="button" className="reaction-option" key={key} aria-label={`React with ${key}`}
        style={{ "--angle": `${index * 60 - 90}deg` } as CSSProperties}
        onClick={() => { send({ id: createIdeaId(), kind: "reaction", value: key as keyof typeof reactions, position: position() }); setWheelAnchor(null); reactionTrigger.current?.focus(); }}>{glyph}</button>)}</div>}
    {chatOpen && <form className="cursor-chat-composer" aria-label="Cursor chat message" style={{ left: screenPosition?.x ?? 220, top: screenPosition?.y ?? 160 }}
      onSubmit={(event) => { event.preventDefault(); if (!message.trim()) return; send({ id: createIdeaId(), kind: "chat", value: message.trim(), position: position() }); setMessage(""); setChatOpen(false); onClose(); }}
      onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { setMessage(""); setChatOpen(false); onClose(); } }}>
      <label htmlFor="cursor-message">Say something nearby</label><div><input ref={input} id="cursor-message" autoComplete="off" maxLength={140} placeholder="Type a quick message…" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} /><button type="submit" disabled={!message.trim()} aria-label="Send cursor message">↵</button></div>
      <small>Enter to send · Esc to cancel · disappears in 6s</small>
    </form>}
  </>;
}
