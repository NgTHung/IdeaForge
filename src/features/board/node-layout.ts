import { ideaCardSize, type Idea } from "./model.ts";

export type NodeSize = { width: number; height: number };
export type NodePosition = { x: number; y: number };

export const NODE_CLEARANCE = 48;

function overlapsWithClearance(first: NodePosition, firstSize: NodeSize, second: NodePosition, secondSize: NodeSize) {
  return first.x - NODE_CLEARANCE / 2 < second.x + secondSize.width + NODE_CLEARANCE / 2 &&
    first.x + firstSize.width + NODE_CLEARANCE / 2 > second.x - NODE_CLEARANCE / 2 &&
    first.y - NODE_CLEARANCE / 2 < second.y + secondSize.height + NODE_CLEARANCE / 2 &&
    first.y + firstSize.height + NODE_CLEARANCE / 2 > second.y - NODE_CLEARANCE / 2;
}

const GRID_CELLS = 2401;
const gridCells = (() => {
  const cells = [{ x: 0, y: 0 }];
  for (let radius = 1; cells.length < GRID_CELLS; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) cells.push({ x, y: -radius });
    for (let y = -radius + 1; y <= radius; y += 1) cells.push({ x: radius, y });
    for (let x = radius - 1; x >= -radius; x -= 1) cells.push({ x, y: radius });
    for (let y = radius - 1; y > -radius; y -= 1) cells.push({ x: -radius, y });
  }
  return cells.slice(0, GRID_CELLS);
})();

export function resolveNodeOverlaps(
  ideas: Idea[],
  measured: Record<string, NodeSize | undefined> = {},
  fixedIds: ReadonlySet<string> = new Set(),
  clusterLabels: ReadonlyMap<string, string> = new Map(),
): Map<string, NodePosition> {
  const positions = new Map(ideas.map((idea) => [idea.id, { ...idea.position }]));
  const sizes = new Map(ideas.map((idea) => [idea.id, measured[idea.id] ?? ideaCardSize(idea, clusterLabels.get(idea.id))]));
  // Pinned cards keep their saved positions, like cards in fixedIds, so they are placed first and never move.
  const movable = (idea: Idea) => !idea.pinned && !fixedIds.has(idea.id);
  const ordered = [...ideas].sort((left, right) => Number(movable(left)) - Number(movable(right)) || left.id.localeCompare(right.id));
  const placed: { position: NodePosition; size: NodeSize }[] = [];
  const isFree = (position: NodePosition, size: NodeSize) =>
    placed.every((other) => !overlapsWithClearance(position, size, other.position, other.size));

  for (const idea of ordered) {
    const size = sizes.get(idea.id)!;
    let position = positions.get(idea.id)!;
    if (movable(idea) && !isFree(position, size)) {
      const stepX = Math.max(24, Math.round(size.width / 4));
      const stepY = Math.max(24, Math.round(size.height / 4));
      const free = gridCells.find((cell) => isFree({ x: idea.position.x + cell.x * stepX, y: idea.position.y + cell.y * stepY }, size));
      if (free) position = { x: idea.position.x + free.x * stepX, y: idea.position.y + free.y * stepY };
      else {
        const columnWidth = Math.max(size.width, ...[...sizes.values()].map((other) => other.width)) + NODE_CLEARANCE;
        for (let slot = 1; slot <= placed.length * 2 + 3; slot += 1) {
          const candidate = { x: idea.position.x + columnWidth * slot, y: idea.position.y };
          if (isFree(candidate, size)) {
            position = candidate;
            break;
          }
        }
      }
      positions.set(idea.id, position);
    }
    placed.push({ position, size });
  }
  return positions;
}

export function withResolvedNodeOverlaps<T extends { ideas: Idea[] }>(
  board: T,
  measured: Record<string, NodeSize | undefined> = {},
  fixedIds: ReadonlySet<string> = new Set(),
  clusterLabels: ReadonlyMap<string, string> = new Map(),
): T {
  const positions = resolveNodeOverlaps(board.ideas, measured, fixedIds, clusterLabels);
  let changed = false;
  const ideas = board.ideas.map((idea) => {
    const position = positions.get(idea.id)!;
    if (position.x === idea.position.x && position.y === idea.position.y) return idea;
    changed = true;
    return { ...idea, position };
  });
  return changed ? { ...board, ideas } : board;
}
