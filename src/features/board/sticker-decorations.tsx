"use client";

import { useRef, useState } from "react";
import { useReactFlow, ViewportPortal } from "@xyflow/react";
import { stickerCatalog, type BoardDecoration, type StickerKind } from "./board-social-contract";

export function StickerPicker({ canWrite, onPlace }: { canWrite: boolean; onPlace: (kind: StickerKind) => void }) {
  return <details className="sticker-picker"><summary>✿ Stickers</summary><div className="sticker-palette"><strong>Decorate the board</strong><p>Pick a sticker, then click the canvas. Drag it to move.</p>
    <div>{(["star", "heart", "cat", "flower", "cloud", "rainbow"] as const).map((kind) => <button key={kind} type="button" disabled={!canWrite} aria-label={`Place ${stickerCatalog[kind].label} sticker`} onClick={(event) => { onPlace(kind); event.currentTarget.closest("details")?.removeAttribute("open"); }}><span aria-hidden="true">{stickerCatalog[kind].glyph}</span>{stickerCatalog[kind].label}</button>)}</div>
    {!canWrite && <p>Only editors can place decorations.</p>}
  </div></details>;
}
export function StickerDecorations({ decorations, canWrite, onMove, onRemove }: {
  decorations: BoardDecoration[]; canWrite: boolean;
  onMove: (id: string, position: BoardDecoration["position"]) => void; onRemove: (id: string) => void;
}) {
  const flow = useReactFlow();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; position: BoardDecoration["position"] } | null>(null);
  const drag = useRef<{ id: string; start: BoardDecoration["position"]; origin: BoardDecoration["position"]; position: BoardDecoration["position"] } | null>(null);
  return <ViewportPortal><div className="sticker-decorations">{decorations.map((decoration) => {
    const position = draft?.id === decoration.id ? draft.position : decoration.position;
    const sticker = stickerCatalog[decoration.kind];
    if (!sticker) return null;
    return <div onClick={(event) => event.stopPropagation()} className="board-sticker nodrag nopan" key={decoration.id} data-sticker-id={decoration.id} data-selected={selected === decoration.id} data-dragging={draft?.id === decoration.id} style={{ left: position.x, top: position.y }}>
      <button type="button" className="sticker-handle" aria-label={`${sticker.label} decoration by ${decoration.author}${canWrite ? '. Drag or use arrow keys to move; Delete to remove.' : ''}`} aria-disabled={!canWrite}
        onFocus={() => setSelected(decoration.id)} onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setSelected(null); }}
        onPointerDown={(event) => {
          event.stopPropagation(); if (!canWrite || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId); setSelected(decoration.id);
          drag.current = { id: decoration.id, origin: decoration.position, position: decoration.position, start: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }) };
        }} onPointerMove={(event) => {
          if (drag.current?.id !== decoration.id) return; event.stopPropagation();
          const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const position = { x: drag.current.origin.x + point.x - drag.current.start.x, y: drag.current.origin.y + point.y - drag.current.start.y };
          drag.current.position = position; setDraft({ id: decoration.id, position });
        }} onPointerUp={(event) => { event.stopPropagation(); if (drag.current?.id === decoration.id) { onMove(decoration.id, drag.current.position); drag.current = null; setDraft(null); } }}
        onPointerCancel={() => { drag.current = null; setDraft(null); }} onLostPointerCapture={() => { drag.current = null; setDraft(null); }}
        onKeyDown={(event) => {
          event.stopPropagation(); if (!canWrite) return;
          const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const offset = offsets[event.key];
          if (offset) { event.preventDefault(); const step = event.shiftKey ? 30 : 10; onMove(decoration.id, { x: decoration.position.x + offset[0] * step, y: decoration.position.y + offset[1] * step }); }
          if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); onRemove(decoration.id); }
          if (event.key === "Escape") { setSelected(null); event.currentTarget.blur(); }
        }}><span aria-hidden="true">{sticker.glyph}</span></button>
      {selected === decoration.id && canWrite && <button type="button" className="sticker-remove" aria-label={`Remove ${sticker.label} decoration`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemove(decoration.id)}>×</button>}
    </div>;
  })}</div></ViewportPortal>;
}
