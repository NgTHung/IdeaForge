"use client";

import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import { roundedEdgePath, type EdgeRoute } from "./edge-routing";

export type OrthogonalEdgeData = { route: EdgeRoute; directional: boolean; labelVisible: boolean };
export type OrthogonalCanvasEdge = Edge<OrthogonalEdgeData, "orthogonal">;

export function OrthogonalEdge({ id, data, style, selected, interactionWidth }: EdgeProps<OrthogonalCanvasEdge>) {
  if (!data?.route) return null;
  const { route, directional, labelVisible } = data;
  const path = roundedEdgePath(route);
  const color = typeof style?.stroke === "string" ? style.stroke : "#4b8a79";
  const markerId = `orthogonal-arrow-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  return <>
    {directional && <defs><marker id={markerId} viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="12" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 1 L 12 6 L 0 11 Z" fill={color} /></marker></defs>}
    <BaseEdge id={id} path={path} style={{ ...style, strokeLinejoin: "round", strokeLinecap: directional ? "butt" : "round" }} markerEnd={directional ? `url(#${markerId})` : undefined} interactionWidth={interactionWidth ?? 24} />
    {route.label && <EdgeLabelRenderer><div
      className={`board-edge-label${labelVisible ? " is-visible" : ""}`}
      style={{ transform: `translate(-50%, -50%) translate(${route.label.x}px, ${route.label.y}px)` }}
      aria-hidden="true"
    ><span className="board-edge-label-badge" style={{ borderColor: color, color }}>{route.label.text}</span></div></EdgeLabelRenderer>}
    {selected && <title>{route.label?.text ?? "Link"}</title>}
  </>;
}
