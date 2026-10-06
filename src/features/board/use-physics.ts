"use client";

import { useEffect, useRef } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import type { Board } from "./model";

type Particle = SimulationNodeDatum & { id: string; x: number; y: number; pinned: boolean };
type Spring = SimulationLinkDatum<Particle> & { source: string | Particle; target: string | Particle };

// Card centers share one simulation. Weak forces and slow cooling make movement soft without drawing cards to the origin.
const CARD_CENTER = { x: 130, y: 70 };
const MOTION = {
  collisionRadius: 150,
  collisionStrength: 0.4,
  repulsion: -55,
  linkDistance: 345,
  linkStrength: 0.026,
  alphaDecay: 0.035,
  velocityDecay: 0.8,
  initialAlpha: 0.3,
  reheatAlpha: 0.3,
  releaseAlpha: 0.3,
};

export function usePhysics(board: Board, enabled: boolean, frozenId: string | null,
  onPositions: (positions: Map<string, { x: number; y: number }>) => void) {
  const simulation = useRef<Simulation<Particle, Spring> | null>(null);
  const particles = useRef(new Map<string, Particle>());
  const latest = useRef({ board, enabled, frozenId, onPositions });
  useEffect(() => { latest.current = { board, enabled, frozenId, onPositions }; }, [board, enabled, frozenId, onPositions]);
  const frame = useRef<number | null>(null);
  const dragging = useRef<string | null>(null);
  const shape = `${board.ideas.map((idea) => idea.id).join("|")}:${board.relationships.map((link) => `${link.id}:${link.source}:${link.target}`).join("|")}`;

  useEffect(() => {
    const sim = forceSimulation<Particle, Spring>([])
      .force("charge", forceManyBody<Particle>().strength(MOTION.repulsion).distanceMax(420))
      .force("collision", forceCollide<Particle>(MOTION.collisionRadius).strength(MOTION.collisionStrength))
      .force("links", forceLink<Particle, Spring>([]).id((node) => node.id).distance(MOTION.linkDistance).strength(MOTION.linkStrength))
      .alphaDecay(MOTION.alphaDecay).velocityDecay(MOTION.velocityDecay).stop();
    simulation.current = sim;
    sim.on("tick", () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (!latest.current.enabled) return;
        const positions = new Map<string, { x: number; y: number }>();
        for (const node of particles.current.values()) {
          if (node.id !== dragging.current && node.id !== latest.current.frozenId && !node.pinned)
            positions.set(node.id, { x: node.x - CARD_CENTER.x, y: node.y - CARD_CENTER.y });
        }
        if (positions.size) latest.current.onPositions(positions);
      });
    });
    return () => { sim.stop(); sim.on("tick", null); if (frame.current !== null) cancelAnimationFrame(frame.current); simulation.current = null; };
  }, []);

  useEffect(() => {
    const sim = simulation.current;
    if (!sim) return;
    const ids = new Set(latest.current.board.ideas.map((idea) => idea.id));
    for (const id of particles.current.keys()) if (!ids.has(id)) particles.current.delete(id);
    for (const idea of latest.current.board.ideas) {
      if (!particles.current.has(idea.id)) particles.current.set(idea.id, {
        id: idea.id, x: idea.position.x + CARD_CENTER.x, y: idea.position.y + CARD_CENTER.y, pinned: idea.pinned,
      });
    }
    sim.nodes([...particles.current.values()]);
    const links: Spring[] = latest.current.board.relationships
      .filter((link) => ids.has(link.source) && ids.has(link.target))
      .map((link) => ({ source: link.source, target: link.target }));
    (sim.force("links") as ReturnType<typeof forceLink<Particle, Spring>>).links(links);
    if (latest.current.enabled) sim.alpha(MOTION.initialAlpha).restart();
  }, [shape]);

  const pinSignature = board.ideas.map((idea) => `${idea.id}:${idea.pinned}`).join("|");
  useEffect(() => {
    for (const idea of latest.current.board.ideas) {
      const node = particles.current.get(idea.id);
      if (!node) continue;
      node.pinned = idea.pinned;
      if (idea.pinned || idea.id === frozenId) {
        node.x = idea.position.x + CARD_CENTER.x;
        node.y = idea.position.y + CARD_CENTER.y;
        node.fx = node.x;
        node.fy = node.y;
      } else if (idea.id !== dragging.current) {
        node.fx = null;
        node.fy = null;
      }
    }
  }, [frozenId, pinSignature]);
  useEffect(() => {
    if (!enabled) simulation.current?.stop();
    else simulation.current?.alpha(MOTION.reheatAlpha).restart();
  }, [enabled]);

  return {
    dragStart(id: string) {
      dragging.current = id;
      const node = particles.current.get(id);
      if (node) { node.fx = node.x; node.fy = node.y; }
    },
    drag(id: string, position: { x: number; y: number }) {
      const node = particles.current.get(id);
      if (node) { node.x = position.x + CARD_CENTER.x; node.y = position.y + CARD_CENTER.y; node.fx = node.x; node.fy = node.y; }
    },
    dragStop(id: string, position: { x: number; y: number }, pinned: boolean) {
      dragging.current = null;
      const node = particles.current.get(id);
      if (node) {
        node.x = position.x + CARD_CENTER.x; node.y = position.y + CARD_CENTER.y;
        node.fx = pinned ? node.x : null; node.fy = pinned ? node.y : null;
      }
      if (latest.current.enabled) simulation.current?.alpha(MOTION.releaseAlpha).restart();
    },
    reheat() { if (latest.current.enabled) simulation.current?.alpha(MOTION.reheatAlpha).restart(); },
  };
}
