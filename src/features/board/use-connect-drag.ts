"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

type Preview = { sourceId: string; x1: number; y1: number; x2: number; y2: number; active: boolean };
type Drag = { sourceId: string; pointerId: number; startX: number; startY: number; x1: number; y1: number };

export function useConnectDrag(canvas: RefObject<HTMLDivElement | null>, handlers: {
  onStart: (sourceId: string) => void;
  onDrop: (sourceId: string, targetId: string) => void;
  onCancel: () => void;
}) {
  const drag = useRef<Drag | null>(null);
  const latest = useRef(handlers);
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => { latest.current = handlers; }, [handlers]);

  useEffect(() => {
    function move(event: globalThis.PointerEvent) {
      const current = drag.current;
      const bounds = canvas.current?.getBoundingClientRect();
      if (!current || !bounds || event.pointerId !== current.pointerId) return;
      const active = Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 7;
      setPreview({ sourceId: current.sourceId, x1: current.x1, y1: current.y1,
        x2: event.clientX - bounds.left, y2: event.clientY - bounds.top, active });
    }
    function end(event: globalThis.PointerEvent) {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;
      drag.current = null;
      setPreview(null);
      const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 7;
      const targetId = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-idea-id]")?.dataset.ideaId;
      if (moved && targetId && targetId !== current.sourceId) latest.current.onDrop(current.sourceId, targetId);
      else latest.current.onCancel();
    }
    function cancel() { if (drag.current) { drag.current = null; setPreview(null); latest.current.onCancel(); } }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", cancel); };
  }, [canvas]);

  const start = useCallback((sourceId: string, event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const bounds = canvas.current?.getBoundingClientRect();
      const bubble = event.currentTarget.getBoundingClientRect();
      if (!bounds) return;
      const x1 = bubble.left + bubble.width / 2 - bounds.left;
      const y1 = bubble.top + bubble.height / 2 - bounds.top;
      drag.current = { sourceId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x1, y1 };
      setPreview({ sourceId, x1, y1, x2: x1, y2: y1, active: false });
      latest.current.onStart(sourceId);
  }, [canvas]);
  const cancel = useCallback(() => {
      if (!drag.current) return;
      drag.current = null;
      setPreview(null);
      latest.current.onCancel();
  }, []);
  return { preview, start, cancel };
}
