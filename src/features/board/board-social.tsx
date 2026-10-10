"use client";

import { useCallback, useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { ViewportPortal } from "@xyflow/react";
import { AnimationContext } from "./board-activity";
import { appendSignal, reactions, type NamedSignal, type SocialSignal } from "./board-social-contract";
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
export function CursorSignals({ signals }: { signals: NamedSignal[] }) {
  const { motion } = useContext(AnimationContext);
  return <ViewportPortal><div className="cursor-signals" aria-live="polite">
    {signals.map((signal) => <div key={`${signal.connectionId}:${signal.id}`} className={`cursor-signal ${motion ? "has-motion" : ""}`} data-kind={signal.kind}
      style={{ left: signal.position.x + 18, top: signal.position.y - 20 }}>
      <span>{signal.kind === "reaction" ? reactions[signal.value] : signal.value}</span><small>{signal.name}</small>
    </div>)}
  </div></ViewportPortal>;
}
export function SocialControls({ chatOpen, setChatOpen, position, screenPosition, onSend, onClose }: {
  chatOpen: boolean; setChatOpen: (value: boolean) => void; position: () => { x: number; y: number };
  screenPosition: { x: number; y: number } | null; onSend: (signal: SocialSignal) => void; onClose: () => void;
}) {
  const [wheelOpen, setWheelOpen] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const reactionTrigger = useRef<HTMLButtonElement>(null);
  const lastSent = useRef(0);
  useEffect(() => { if (chatOpen) input.current?.focus(); }, [chatOpen]);
  useEffect(() => {
    if (!wheelOpen) return;
    root.current?.querySelector<HTMLButtonElement>(".reaction-option")?.focus();
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setWheelOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [wheelOpen]);
  const send = useCallback((signal: SocialSignal) => {
    if (Date.now() - lastSent.current < 300) return;
    lastSent.current = Date.now(); onSend(signal);
  }, [onSend]);
  return <>
    <div className="board-social-controls" ref={root}>
      <button ref={reactionTrigger} type="button" aria-label="Quick reactions" aria-expanded={wheelOpen} onClick={() => { setWheelOpen((value) => !value); setChatOpen(false); }}>☺ <span>React</span></button>
      <button type="button" aria-label="Cursor chat" title="Cursor chat (Enter)" onClick={() => { setWheelOpen(false); setChatOpen(!chatOpen); }}>◌ <span>Chat</span><kbd>↵</kbd></button>
      {wheelOpen && <div className="reaction-wheel" role="dialog" aria-label="Choose a reaction" onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); setWheelOpen(false); reactionTrigger.current?.focus(); }
        if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault(); const choices = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
          const index = choices.indexOf(document.activeElement as HTMLButtonElement);
          choices[(index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + choices.length) % choices.length]?.focus();
        }
      }}><span className="reaction-wheel-center" aria-hidden="true">✦</span>{Object.entries(reactions).map(([key, glyph], index) => <button type="button" className="reaction-option" key={key} aria-label={`React with ${key}`}
        style={{ "--angle": `${index * 60 - 90}deg` } as CSSProperties}
        onClick={() => { send({ id: createIdeaId(), kind: "reaction", value: key as keyof typeof reactions, position: position() }); setWheelOpen(false); reactionTrigger.current?.focus(); }}>{glyph}</button>)}</div>}
    </div>
    {chatOpen && <form className="cursor-chat-composer" aria-label="Cursor chat message" style={{ left: screenPosition?.x ?? 220, top: screenPosition?.y ?? 160 }}
      onSubmit={(event) => { event.preventDefault(); if (!message.trim()) return; send({ id: createIdeaId(), kind: "chat", value: message.trim(), position: position() }); setMessage(""); setChatOpen(false); onClose(); }}
      onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { setMessage(""); setChatOpen(false); onClose(); } }}>
      <label htmlFor="cursor-message">Say something nearby</label><div><input ref={input} id="cursor-message" autoComplete="off" maxLength={140} placeholder="Type a quick message…" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} /><button type="submit" disabled={!message.trim()} aria-label="Send cursor message">↵</button></div>
      <small>Enter to send · Esc to cancel · disappears in 6s</small>
    </form>}
  </>;
}
