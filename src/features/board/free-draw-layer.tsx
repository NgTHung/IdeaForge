"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Panel, useReactFlow, useViewport, ViewportPortal } from "@xyflow/react";
import { createIdeaId } from "./id";
import type { FreeDrawStroke } from "./model";
import { freeDrawColor, freeDrawWidth } from "./free-draw-style";

export type FreeDrawTool = "pencil" | "eraser";
type Point = FreeDrawStroke["points"][number];
type Gesture = { id: string; pointerId: number; tool: FreeDrawTool; points: Point[]; erased: Set<string>; color: string; width: number; lastPresenceUpdate: number };

function distanceToSegmentSquared(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!dx && !dy) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const fraction = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const nearestX = start.x + fraction * dx;
  const nearestY = start.y + fraction * dy;
  return (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2;
}

function strokePath(points: Point[]) {
  return points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
}

export function FreeDrawLayer({
  strokes,
  liveStrokes = [],
  tool,
  color,
  width,
  defaultColor,
  enabled,
  onStroke,
  onErase,
  onDraft,
}: {
  strokes: FreeDrawStroke[];
  liveStrokes?: FreeDrawStroke[];
  tool: FreeDrawTool | null;
  color: string;
  width: number;
  defaultColor: string;
  enabled: boolean;
  onStroke: (stroke: FreeDrawStroke) => void;
  onErase: (ids: string[]) => void;
  onDraft?: (stroke: FreeDrawStroke | null) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const { zoom } = useViewport();
  const inputLayer = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [erasingIds, setErasingIds] = useState<string[]>([]);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const active = enabled && tool !== null;

  useEffect(() => () => onDraft?.(null), [onDraft]);

  function pointFromEvent(event: ReactPointerEvent<SVGSVGElement>) {
    return screenToFlowPosition({ x: event.clientX, y: event.clientY });
  }

  function strokeIdsAt(point: Point, radius: number) {
    const radiusSquared = radius * radius;
    return strokes.filter((stroke) => {
      if (stroke.points.length === 1) return distanceToSegmentSquared(point, stroke.points[0], stroke.points[0]) <= radiusSquared;
      return stroke.points.some((start, index) => index > 0 && distanceToSegmentSquared(point, stroke.points[index - 1], start) <= radiusSquared);
    }).map((stroke) => stroke.id);
  }

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!active || !tool || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const nextGesture: Gesture = { id: createIdeaId(), pointerId: event.pointerId, tool, points: [point], erased: new Set(), color, width, lastPresenceUpdate: event.timeStamp };
    gesture.current = nextGesture;
    inputLayer.current?.setPointerCapture(event.pointerId);
    if (tool === "pencil") setDraftPoints(nextGesture.points);
    else {
      const radius = 16 / Math.max(zoom, 0.15);
      for (const id of strokeIdsAt(point, radius)) nextGesture.erased.add(id);
      setErasingIds([...nextGesture.erased]);
      setCursorPoint(point);
    }
    if (tool === "pencil") onDraft?.({ id: nextGesture.id, points: [point], color: nextGesture.color, width: nextGesture.width });
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!active || !tool) return;
    const point = pointFromEvent(event);
    const activeGesture = gesture.current;
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) {
      if (tool === "eraser") setCursorPoint(point);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (activeGesture.tool === "pencil") {
      const previous = activeGesture.points[activeGesture.points.length - 1];
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 1.2 / Math.max(zoom, 0.15)) return;
      activeGesture.points.push(point);
      setDraftPoints([...activeGesture.points]);
      if (event.timeStamp - activeGesture.lastPresenceUpdate >= 80) {
        activeGesture.lastPresenceUpdate = event.timeStamp;
        onDraft?.({ id: activeGesture.id, points: [...activeGesture.points], color: activeGesture.color, width: activeGesture.width });
      }
    } else {
      const radius = 16 / Math.max(zoom, 0.15);
      for (const id of strokeIdsAt(point, radius)) activeGesture.erased.add(id);
      setErasingIds([...activeGesture.erased]);
      setCursorPoint(point);
    }
  }

  function finishGesture(event: ReactPointerEvent<SVGSVGElement>, commit: boolean) {
    const activeGesture = gesture.current;
    if (!activeGesture || activeGesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current = null;
    if (commit && activeGesture.tool === "pencil") {
      const points = activeGesture.points;
      if (points.length === 1) points.push({ x: points[0].x + 0.1, y: points[0].y + 0.1 });
      onStroke({ id: activeGesture.id, points, color: activeGesture.color, width: activeGesture.width });
      onDraft?.(null);
    } else if (commit && activeGesture.erased.size) onErase([...activeGesture.erased]);
    else if (activeGesture.tool === "pencil") onDraft?.(null);
    setDraftPoints([]);
    setErasingIds([]);
  }

  return <>
    <ViewportPortal>
      <svg className="board-free-draw-visual" aria-hidden="true">
        {strokes.filter((stroke) => !erasingIds.includes(stroke.id)).map((stroke) => <path key={stroke.id} d={strokePath(stroke.points)} style={{ stroke: freeDrawColor(stroke.color, defaultColor), strokeWidth: freeDrawWidth(stroke.width) }} />)}
        {liveStrokes.map((stroke) => <path className="board-free-draw-live" key={stroke.id} d={strokePath(stroke.points)} style={{ stroke: freeDrawColor(stroke.color, color), strokeWidth: freeDrawWidth(stroke.width) }} />)}
        {draftPoints.length > 0 && <path className="board-free-draw-draft" d={strokePath(draftPoints)} style={{ stroke: color, strokeWidth: width }} />}
        {active && tool === "eraser" && cursorPoint && <circle className="board-free-draw-eraser-cursor" cx={cursorPoint.x} cy={cursorPoint.y} r={16 / Math.max(zoom, 0.15)} />}
      </svg>
    </ViewportPortal>
    {/* Capture input in screen space so canvas pan and zoom cannot shift or shrink the hit area. */}
    <Panel position="top-left" className="board-free-draw-panel"
      style={{ inset: 0, width: "100%", height: "100%", margin: 0, pointerEvents: "none" }}>
      <svg
        ref={inputLayer}
        className={`board-free-draw-input${active ? " is-active" : ""}${tool === "eraser" ? " is-erasing" : ""}`}
        aria-hidden="true"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={(event) => finishGesture(event, true)}
        onPointerCancel={(event) => finishGesture(event, false)}
        onLostPointerCapture={(event) => finishGesture(event, false)}
      >
        <rect width="100%" height="100%" fill="transparent" />
      </svg>
    </Panel>
  </>;
}
