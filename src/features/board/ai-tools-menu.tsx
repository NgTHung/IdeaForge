"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { BoardIcon } from "./board-icons";
import "./ai-tools-menu.css";

export function AiToolsMenu({ onAssistant, onSuggestedLinks, onConclusion, hasConclusion }: {
  onAssistant: () => void;
  onSuggestedLinks: () => void;
  onConclusion: () => void;
  hasConclusion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    triggerRef.current?.focus();
    action();
  }

  function moveMenuFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : current < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1)
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  return <div className="board-ai-tools" ref={rootRef}>
    <button ref={triggerRef} className="board-ai-tools-trigger" type="button" aria-label="AI tools" aria-expanded={open}
      aria-haspopup="menu" aria-controls="board-ai-tools-menu" title="AI tools" onClick={() => setOpen((value) => !value)}
      onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}>
      <BoardIcon name="assistant" />
    </button>
    {open && <div id="board-ai-tools-menu" className="board-ai-tools-menu" ref={menuRef} role="menu" aria-label="AI tools" onKeyDown={moveMenuFocus}>
      <button type="button" role="menuitem" onClick={() => choose(onAssistant)}><BoardIcon name="assistant" /><span>Assistant</span></button>
      <button type="button" role="menuitem" onClick={() => choose(onSuggestedLinks)}><BoardIcon name="suggestions" /><span>Suggested Links</span></button>
      <button type="button" role="menuitem" onClick={() => choose(onConclusion)}><BoardIcon name="conclusion" /><span>Conclusion</span>{hasConclusion && <span className="board-ai-tools-saved" aria-label="Saved">Saved</span>}</button>
    </div>}
  </div>;
}
