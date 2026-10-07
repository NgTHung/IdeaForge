import { IDEA_CARD_SIZE, type Idea } from "./model.ts";

export type NodeSize = { width: number; height: number };
export type NodePosition = { x: number; y: number };

export const NODE_CLEARANCE = 48;

function overlapsWithClearance(first: NodePosition, firstSize: NodeSize, second: NodePosition, secondSize: NodeSize) {
  return first.x - NODE_CLEARANCE / 2 < second.x + secondSize.width + NODE_CLEARANCE / 2 &&
    first.x + firstSize.width + NODE_CLEARANCE / 2 > second.x - NODE_CLEARANCE / 2 &&
    first.y - NODE_CLEARANCE / 2 < second.y + secondSize.height + NODE_CLEARANCE / 2 &&
    first.y + firstSize.height + NODE_CLEARANCE / 2 > second.y - NODE_CLEARANCE / 2;
}

function gridOffsets(stepX: number, stepY: number, limit: number) {
  const cells = [{ x: 0, y: 0 }];
  for (let radius = 1; cells.length < limit; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) cells.push({ x, y: -radius });
    for (let y = -radius + 1; y <= radius; y += 1) cells.push({ x: radius, y });
    for (let x = radius - 1; x >= -radius; x -= 1) cells.push({ x, y: radius });
    for (let y = radius - 1; y > -radius; y -= 1) cells.push({ x: -radius, y });
  }
  return cells.slice(0, limit).map((cell) => ({ x: cell.x * stepX, y: cell.y * stepY }));
}

export function resolveNodeOverlaps(
  ideas: Idea[],
  measured: Record<string, NodeSize | undefined> = {},
  fixedIds: ReadonlySet<string> = new Set(),
): Map<string, NodePosition> {
  const positions = new Map(ideas.map((idea) => [idea.id, { ...idea.position }]));
  const sizes = new Map(ideas.map((idea) => [idea.id, measured[idea.id] ?? IDEA_CARD_SIZE]));
  // Pinned cards keep their saved positions, like cards in fixedIds, so they are placed first and never move.
  const movable = (idea: Idea) => !idea.pinned && !fixedIds.has(idea.id);
  const ordered = [...ideas].sort((left, right) => Number(movable(left)) - Number(movable(right)) || left.id.localeCompare(right.id));
  const placed: Idea[] = [];

  for (const idea of ordered) {
    const size = sizes.get(idea.id)!;
    let position = positions.get(idea.id)!;
    const conflicts = () => placed.some((other) => overlapsWithClearance(position, size, positions.get(other.id)!, sizes.get(other.id)!));
    if (movable(idea) && conflicts()) {
      const offsets = gridOffsets(Math.max(24, Math.round(size.width / 4)), Math.max(24, Math.round(size.height / 4)), 2401);
      const free = offsets.find((offset) => !placed.some((other) => overlapsWithClearance(
        { x: idea.position.x + offset.x, y: idea.position.y + offset.y }, size,
        positions.get(other.id)!, sizes.get(other.id)!,
      )));
      if (free) position = { x: idea.position.x + free.x, y: idea.position.y + free.y };
      else {
        const maxWidth = Math.max(size.width, ...[...sizes.values()].map((other) => other.width));
        const stepX = maxWidth + NODE_CLEARANCE;
        for (let slot = 1; slot <= placed.length * 2 + 3; slot += 1) {
          const candidate = { x: idea.position.x + stepX * slot, y: idea.position.y };
          if (placed.every((other) => !overlapsWithClearance(candidate, size, positions.get(other.id)!, sizes.get(other.id)!))) {
            position = candidate;
            break;
          }
        }
      }
      positions.set(idea.id, position);
    }
    placed.push(idea);
  }
  return positions;
}

export function withResolvedNodeOverlaps<T extends { ideas: Idea[] }>(
  board: T,
  measured: Record<string, NodeSize | undefined> = {},
  fixedIds: ReadonlySet<string> = new Set(),
): T {
  const positions = resolveNodeOverlaps(board.ideas, measured, fixedIds);
  let changed = false;
  const ideas = board.ideas.map((idea) => {
    const position = positions.get(idea.id)!;
    if (position.x === idea.position.x && position.y === idea.position.y) return idea;
    changed = true;
    return { ...idea, position };
  });
  return changed ? { ...board, ideas } : board;
}
