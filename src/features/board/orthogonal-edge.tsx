"use client";

import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import { roundedEdgePath, type EdgeRoute } from "./edge-routing";

export type OrthogonalEdgeData = { route: EdgeRoute; directional: boolean };
export type OrthogonalCanvasEdge = Edge<OrthogonalEdgeData, "orthogonal">;

export function OrthogonalEdge({ id, data, style, selected, interactionWidth }: EdgeProps<OrthogonalCanvasEdge>) {
  if (!data?.route) return null;
  const { route, directional } = data;
  const path = roundedEdgePath(route);
  const color = typeof style?.stroke === "string" ? style.stroke : "#4b8a79";
  const markerId = `orthogonal-arrow-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  return <>
    {directional && <defs><marker id={markerId} viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="12" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 1 L 12 6 L 0 11 Z" fill={color} /></marker></defs>}
    <BaseEdge id={id} path={path} style={{ ...style, strokeLinejoin: "round", strokeLinecap: directional ? "butt" : "round" }} markerEnd={directional ? `url(#${markerId})` : undefined} interactionWidth={interactionWidth ?? 24} />
    {route.label && <g className={`board-edge-label${route.labelCrowded ? " is-crowded" : ""}`} pointerEvents="none" aria-hidden="true">
      <rect x={route.label.x - route.label.width / 2} y={route.label.y - route.label.height / 2} width={route.label.width} height={route.label.height} rx="11" fill="#fff" stroke="#dce7e3" strokeWidth="1" />
      <text x={route.label.x} y={route.label.y} textAnchor="middle" dominantBaseline="central" fill="#3c5260" fontSize="12" fontWeight="700">{route.label.text}</text>
    </g>}
    {selected && <title>{route.label?.text ?? "Link"}</title>}
  </>;
}
