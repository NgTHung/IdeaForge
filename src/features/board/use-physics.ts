"use client";

import { useEffect, useRef } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { IDEA_CARD_SIZE, type Board } from "./model";
import { resolveNodeOverlaps } from "./node-layout";

type Particle = SimulationNodeDatum & { id: string; x: number; y: number; pinned: boolean };
type Spring = SimulationLinkDatum<Particle> & { source: string | Particle; target: string | Particle };
export type Contact = { first: string; second: string; axis: "x" | "y" };

// Card centers share one simulation. Weak forces and slow cooling make movement soft without drawing cards to the origin.
const CARD_CENTER = { x: IDEA_CARD_SIZE.width / 2, y: IDEA_CARD_SIZE.height / 2 };
const CONTACT_GAP = 42;
const MOTION = {
  collisionRadius: Math.ceil(Math.hypot(IDEA_CARD_SIZE.width + 48, IDEA_CARD_SIZE.height + 48) / 2),
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
  onPositions: (positions: Map<string, { x: number; y: number }>) => void,
  onContacts: (contacts: Contact[]) => void) {
  const simulation = useRef<Simulation<Particle, Spring> | null>(null);
  const particles = useRef(new Map<string, Particle>());
  const latest = useRef({ board, enabled, frozenId, onPositions, onContacts });
  useEffect(() => { latest.current = { board, enabled, frozenId, onPositions, onContacts }; }, [board, enabled, frozenId, onPositions, onContacts]);
  const frame = useRef<number | null>(null);
  const dragging = useRef<string | null>(null);
  const activeContacts = useRef(new Set<string>());
  const shape = `${board.ideas.map((idea) => idea.id).join("|")}:${board.relationships.map((link) => `${link.id}:${link.source}:${link.target}`).join("|")}`;

  function checkContacts() {
    const nodes = [...particles.current.values()];
    const currentContacts = new Set<string>();
    const impacts: Contact[] = [];
    for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
      const first = nodes[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
        const second = nodes[secondIndex];
        const dx = Math.abs(first.x - second.x);
        const dy = Math.abs(first.y - second.y);
        const gapX = Math.max(0, dx - IDEA_CARD_SIZE.width);
        const gapY = Math.max(0, dy - IDEA_CARD_SIZE.height);
        if (Math.hypot(gapX, gapY) > CONTACT_GAP) continue;
        const key = [first.id, second.id].sort().join(":");
        currentContacts.add(key);
        if (!activeContacts.current.has(key)) impacts.push({
          first: first.id,
          second: second.id,
          axis: dx / IDEA_CARD_SIZE.width >= dy / IDEA_CARD_SIZE.height ? "x" : "y",
        });
      }
    }
    activeContacts.current = currentContacts;
    if (impacts.length) latest.current.onContacts(impacts);
  }

  useEffect(() => {
    const sim = forceSimulation<Particle, Spring>([])
      .force("charge", forceManyBody<Particle>().strength(MOTION.repulsion).distanceMax(420))
      .force("collision", forceCollide<Particle>(MOTION.collisionRadius).strength(MOTION.collisionStrength))
      .force("links", forceLink<Particle, Spring>([]).id((node) => node.id).distance(MOTION.linkDistance).strength(MOTION.linkStrength))
      .alphaDecay(MOTION.alphaDecay).velocityDecay(MOTION.velocityDecay).stop();
    simulation.current = sim;
    sim.on("tick", () => {
      checkContacts();
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (!latest.current.enabled) return;
        if (!dragging.current) {
          const ideas = latest.current.board.ideas.map((idea) => {
            const node = particles.current.get(idea.id);
            return node ? { ...idea, position: { x: node.x - CARD_CENTER.x, y: node.y - CARD_CENTER.y } } : idea;
          });
          const fixed = new Set([latest.current.frozenId].filter((id): id is string => Boolean(id)));
          const resolved = resolveNodeOverlaps(ideas, {}, fixed);
          for (const [id, position] of resolved) {
            const node = particles.current.get(id);
            if (!node || node.x - CARD_CENTER.x === position.x && node.y - CARD_CENTER.y === position.y) continue;
            node.x = position.x + CARD_CENTER.x;
            node.y = position.y + CARD_CENTER.y;
            node.vx = 0;
            node.vy = 0;
          }
        }
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
    checkContacts();
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
    stop() { simulation.current?.stop(); },
    syncPositions(positions: Map<string, { x: number; y: number }>) {
      for (const [id, position] of positions) {
        const node = particles.current.get(id);
        if (!node) continue;
        node.x = position.x + CARD_CENTER.x;
        node.y = position.y + CARD_CENTER.y;
        if (node.pinned) { node.fx = node.x; node.fy = node.y; }
      }
      checkContacts();
    },
    dragStart(id: string) {
      dragging.current = id;
      const node = particles.current.get(id);
      if (node) { node.fx = node.x; node.fy = node.y; }
    },
    drag(id: string, position: { x: number; y: number }) {
      const node = particles.current.get(id);
      if (node) { node.x = position.x + CARD_CENTER.x; node.y = position.y + CARD_CENTER.y; node.fx = node.x; node.fy = node.y; checkContacts(); }
    },
    dragStop(id: string, position: { x: number; y: number }, pinned: boolean) {
      dragging.current = null;
      const node = particles.current.get(id);
      if (node) {
        node.x = position.x + CARD_CENTER.x; node.y = position.y + CARD_CENTER.y;
        node.fx = pinned ? node.x : null; node.fy = pinned ? node.y : null;
        checkContacts();
      }
      if (latest.current.enabled) simulation.current?.alpha(MOTION.releaseAlpha).restart();
    },
    reheat() { if (latest.current.enabled) simulation.current?.alpha(MOTION.reheatAlpha).restart(); },
  };
}
