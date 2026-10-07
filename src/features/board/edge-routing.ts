import { IDEA_CARD_SIZE, type Idea } from "./model";

export type Point = { x: number; y: number };
export type Side = "left" | "right" | "top" | "bottom";
export type CanvasLink = { id: string; source: string; target: string; label?: string };
export type EdgeRoute = {
  points: Point[];
  sourceSide: Side;
  targetSide: Side;
  bridges: { segment: number; point: Point; radius: number }[];
  curved?: boolean;
  label?: { x: number; y: number; width: number; height: number; text: string };
  labelCrowded?: boolean;
};

type Rect = Point & { width: number; height: number };
type NodeRect = Rect & { id: string };
type Segment = { first: Point; second: Point; horizontal: boolean };
type Endpoint = { edgeId: string; role: "source" | "target"; node: NodeRect; other: NodeRect; side: Side };

const CLEARANCE = 28;
const CORNER_RADIUS = 8;
const ROUTE_MARGIN = CLEARANCE + CORNER_RADIUS + 0.5;
const LANE_GAP = 20;
const PORT_GAP = 24;
const MAX_PORTS_PER_SIDE = 4;
const EPSILON = 0.001;

function center(rect: Rect): Point { return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; }
function inflate(rect: Rect, amount: number): Rect {
  return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 };
}
function overlap(first: number, second: number, third: number, fourth: number) {
  return Math.min(Math.max(first, second), Math.max(third, fourth)) - Math.max(Math.min(first, second), Math.min(third, fourth));
}
function intersects(first: Rect, second: Rect, gap = 0) {
  return first.x < second.x + second.width + gap && first.x + first.width + gap > second.x &&
    first.y < second.y + second.height + gap && first.y + first.height + gap > second.y;
}
function segment(first: Point, second: Point): Segment { return { first, second, horizontal: Math.abs(first.y - second.y) < EPSILON }; }
function segments(points: Point[]) { return points.slice(1).map((point, index) => segment(points[index], point)); }
function endpointKey(edgeId: string, role: Endpoint["role"]) { return `${edgeId}\u0000${role}`; }

function preferredSides(node: NodeRect, other: NodeRect): Side[] {
  const a = center(node);
  const b = center(other);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const horizontal: Side = dx >= 0 ? "right" : "left";
  const vertical: Side = dy >= 0 ? "bottom" : "top";
  return Math.abs(dx) >= Math.abs(dy)
    ? [horizontal, vertical, horizontal === "right" ? "left" : "right", vertical === "bottom" ? "top" : "bottom"]
    : [vertical, horizontal, vertical === "bottom" ? "top" : "bottom", horizontal === "right" ? "left" : "right"];
}

function sideIsOpen(node: NodeRect, side: Side, nodes: Map<string, NodeRect>) {
  const point = side === "left" ? { x: node.x, y: node.y + node.height / 2 } :
    side === "right" ? { x: node.x + node.width, y: node.y + node.height / 2 } :
      side === "top" ? { x: node.x + node.width / 2, y: node.y } : { x: node.x + node.width / 2, y: node.y + node.height };
  const stub = outside(point, side);
  return [...nodes.values()].every((other) => other.id === node.id ||
    stub.x <= other.x - ROUTE_MARGIN || stub.x >= other.x + other.width + ROUTE_MARGIN ||
    stub.y <= other.y - ROUTE_MARGIN || stub.y >= other.y + other.height + ROUTE_MARGIN);
}

function distributePorts(links: CanvasLink[], nodes: Map<string, NodeRect>) {
  const byNode = new Map<string, Endpoint[]>();
  for (const link of links) {
    const source = nodes.get(link.source);
    const target = nodes.get(link.target);
    if (!source || !target || source.id === target.id) continue;
    for (const endpoint of [
      { edgeId: link.id, role: "source" as const, node: source, other: target, side: "right" as Side },
      { edgeId: link.id, role: "target" as const, node: target, other: source, side: "left" as Side },
    ]) byNode.set(endpoint.node.id, [...byNode.get(endpoint.node.id) ?? [], endpoint]);
  }
  const points = new Map<string, { point: Point; side: Side }>();
  for (const endpoints of byNode.values()) {
    const node = endpoints[0].node;
    const sideLength = (side: Side) => side === "left" || side === "right" ? node.height : node.width;
    const physicalCapacity = (side: Side) => Math.max(1, Math.floor((sideLength(side) - 16) / PORT_GAP) + 1);
    const capacity = (side: Side) => Math.min(MAX_PORTS_PER_SIDE, physicalCapacity(side));
    const groups = new Map<Side, Endpoint[]>([["left", []], ["right", []], ["top", []], ["bottom", []]]);
    for (const endpoint of [...endpoints].sort((a, b) => a.edgeId.localeCompare(b.edgeId) || a.role.localeCompare(b.role))) {
      const choices = preferredSides(endpoint.node, endpoint.other);
      endpoint.side = choices.find((side) => groups.get(side)!.length < capacity(side) && sideIsOpen(node, side, nodes)) ??
        choices.find((side) => groups.get(side)!.length < capacity(side)) ??
        choices.find((side) => groups.get(side)!.length < physicalCapacity(side) && sideIsOpen(node, side, nodes)) ??
        choices.find((side) => groups.get(side)!.length < physicalCapacity(side)) ?? choices[0];
      groups.get(endpoint.side)!.push(endpoint);
    }
    for (const [side, group] of groups) {
      group.sort((a, b) => {
        const first = center(a.other);
        const second = center(b.other);
        const position = side === "left" || side === "right" ? first.y - second.y : first.x - second.x;
        return position || a.edgeId.localeCompare(b.edgeId);
      });
      const length = side === "left" || side === "right" ? node.height : node.width;
      const spacing = Math.max(PORT_GAP, (length - 16) / Math.max(1, group.length - 1));
      group.forEach((endpoint, index) => {
        const offset = length / 2 + (index - (group.length - 1) / 2) * spacing;
        const point = side === "left" ? { x: node.x, y: node.y + offset } :
          side === "right" ? { x: node.x + node.width, y: node.y + offset } :
            side === "top" ? { x: node.x + offset, y: node.y } : { x: node.x + offset, y: node.y + node.height };
        points.set(endpointKey(endpoint.edgeId, endpoint.role), { point, side });
      });
    }
  }
  return points;
}

function outside(point: Point, side: Side): Point {
  return side === "left" ? { x: point.x - ROUTE_MARGIN, y: point.y } :
    side === "right" ? { x: point.x + ROUTE_MARGIN, y: point.y } :
      side === "top" ? { x: point.x, y: point.y - ROUTE_MARGIN } : { x: point.x, y: point.y + ROUTE_MARGIN };
}

function blockedByNodes(candidate: Segment, obstacles: Rect[]) {
  return obstacles.some((rect) => candidate.horizontal
    ? candidate.first.y > rect.y + EPSILON && candidate.first.y < rect.y + rect.height - EPSILON &&
      overlap(candidate.first.x, candidate.second.x, rect.x, rect.x + rect.width) > EPSILON
    : candidate.first.x > rect.x + EPSILON && candidate.first.x < rect.x + rect.width - EPSILON &&
      overlap(candidate.first.y, candidate.second.y, rect.y, rect.y + rect.height) > EPSILON);
}

function parallelConflict(candidate: Segment, occupied: Segment[]) {
  return occupied.some((used) => used.horizontal === candidate.horizontal &&
    Math.abs((candidate.horizontal ? candidate.first.y : candidate.first.x) - (used.horizontal ? used.first.y : used.first.x)) < LANE_GAP - EPSILON &&
    overlap(candidate.horizontal ? candidate.first.x : candidate.first.y, candidate.horizontal ? candidate.second.x : candidate.second.y,
      used.horizontal ? used.first.x : used.first.y, used.horizontal ? used.second.x : used.second.y) > EPSILON);
}

function crossingCount(candidate: Segment, occupied: Segment[]) {
  return occupied.reduce((count, used) => {
    if (used.horizontal === candidate.horizontal) return count;
    const horizontal = candidate.horizontal ? candidate : used;
    const vertical = candidate.horizontal ? used : candidate;
    const x = vertical.first.x;
    const y = horizontal.first.y;
    return x > Math.min(horizontal.first.x, horizontal.second.x) + CORNER_RADIUS &&
      x < Math.max(horizontal.first.x, horizontal.second.x) - CORNER_RADIUS &&
      y > Math.min(vertical.first.y, vertical.second.y) + CORNER_RADIUS &&
      y < Math.max(vertical.first.y, vertical.second.y) - CORNER_RADIUS ? count + 1 : count;
  }, 0);
}

class MinHeap {
  private values: { key: number; cost: number; rank: number }[] = [];
  push(value: { key: number; cost: number; rank: number }) {
    const items = this.values;
    items.push(value);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent].rank <= value.rank) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = value;
  }
  pop() {
    const items = this.values;
    if (!items.length) return null;
    const first = items[0];
    const last = items.pop()!;
    if (items.length) {
      let index = 0;
      while (index * 2 + 1 < items.length) {
        let child = index * 2 + 1;
        if (child + 1 < items.length && items[child + 1].rank < items[child].rank) child += 1;
        if (items[child].rank >= last.rank) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return first;
  }
  get length() { return this.values.length; }
}

function routeGrid(start: Point, end: Point, obstacles: Rect[], occupied: Segment[], bounds: Rect, maximumLength: number, allCoords = false): Point[] | null {
  const directDistance = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
  const regionBounds = { left: bounds.x, right: bounds.x + bounds.width, top: bounds.y, bottom: bounds.y + bounds.height };
  const routePenalty = (points: Point[]) => {
    const length = segments(points).reduce((sum, part) => sum + Math.abs(part.second.x - part.first.x) + Math.abs(part.second.y - part.first.y), 0);
    const overrun = Math.max(0, length - directDistance * 2);
    const outerTravel = segments(points).reduce((sum, part) => {
      const midpoint = { x: (part.first.x + part.second.x) / 2, y: (part.first.y + part.second.y) / 2 };
      return sum + ((midpoint.x < regionBounds.left - 80 || midpoint.x > regionBounds.right + 80 || midpoint.y < regionBounds.top - 80 || midpoint.y > regionBounds.bottom + 80) ?
        Math.abs(part.second.x - part.first.x) + Math.abs(part.second.y - part.first.y) : 0);
    }, 0);
    return length + Math.max(0, points.length - 2) * 28 + overrun * 3 + outerTravel * 2;
  };
  const middleX = (start.x + end.x) / 2;
  const middleY = (start.y + end.y) / 2;
  const simple = [
    [start, end],
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
    [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end],
    [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end],
  ].map(simplify).filter((points) => points.every((point) => point.x >= regionBounds.left && point.x <= regionBounds.right && point.y >= regionBounds.top && point.y <= regionBounds.bottom) &&
    segments(points).reduce((length, part) => length + Math.abs(part.second.x - part.first.x) + Math.abs(part.second.y - part.first.y), 0) <= maximumLength &&
    segments(points).every((part) =>
      (part.horizontal || Math.abs(part.first.x - part.second.x) < EPSILON) &&
      !blockedByNodes(part, obstacles) && !parallelConflict(part, occupied) &&
      crossingCount(part, occupied) === 0));
  if (simple.length) return simple.sort((a, b) => routePenalty(a) - routePenalty(b))[0];
  const xs = new Set([start.x, end.x, Math.max(regionBounds.left, Math.min(regionBounds.right, (start.x + end.x) / 2)), regionBounds.left, regionBounds.right]);
  const ys = new Set([start.y, end.y, Math.max(regionBounds.top, Math.min(regionBounds.bottom, (start.y + end.y) / 2)), regionBounds.top, regionBounds.bottom]);
  const addIfInBounds = (set: Set<number>, value: number, minimum: number, maximum: number) => {
    if (value >= minimum && value <= maximum) set.add(value);
  };
  const corridor = inflate({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y) }, 240);
  for (const rect of obstacles.filter((candidate) => allCoords || intersects(candidate, corridor))) {
    addIfInBounds(xs, rect.x - 1, regionBounds.left, regionBounds.right);
    addIfInBounds(xs, rect.x + rect.width + 1, regionBounds.left, regionBounds.right);
    addIfInBounds(ys, rect.y - 1, regionBounds.top, regionBounds.bottom);
    addIfInBounds(ys, rect.y + rect.height + 1, regionBounds.top, regionBounds.bottom);
  }
  for (const used of occupied) {
    const area = inflate({ x: Math.min(used.first.x, used.second.x), y: Math.min(used.first.y, used.second.y),
      width: Math.abs(used.first.x - used.second.x), height: Math.abs(used.first.y - used.second.y) }, LANE_GAP);
    if (!allCoords && !intersects(area, corridor)) continue;
    const value = used.horizontal ? used.first.y : used.first.x;
    const set = used.horizontal ? ys : xs;
    const minimum = used.horizontal ? regionBounds.top : regionBounds.left;
    const maximum = used.horizontal ? regionBounds.bottom : regionBounds.right;
    addIfInBounds(set, value - LANE_GAP, minimum, maximum);
    addIfInBounds(set, value + LANE_GAP, minimum, maximum);
  }
  const columns = [...xs].sort((a, b) => a - b);
  const rows = [...ys].sort((a, b) => a - b);
  const width = columns.length;
  const startX = columns.indexOf(start.x);
  const startY = rows.indexOf(start.y);
  const endX = columns.indexOf(end.x);
  const endY = rows.indexOf(end.y);
  const key = (x: number, y: number, direction: number) => (y * width + x) * 3 + direction;
  const decode = (value: number) => { const cell = Math.floor(value / 3); return { x: cell % width, y: Math.floor(cell / width), direction: value % 3 }; };
  const initial = key(startX, startY, 0);
  const distance = new Map([[initial, 0]]);
  const pathLength = new Map([[initial, 0]]);
  const previous = new Map<number, number>();
  const queue = new MinHeap();
  queue.push({ key: initial, cost: 0, rank: Math.abs(start.x - end.x) + Math.abs(start.y - end.y) });
  const clear = new Map<string, boolean>();
  while (queue.length) {
    const current = queue.pop()!;
    if (current.cost !== distance.get(current.key)) continue;
    const { x, y, direction } = decode(current.key);
    if (x === endX && y === endY) {
      const points: Point[] = [];
      let cursor: number | undefined = current.key;
      while (cursor !== undefined) {
        const cell = decode(cursor);
        points.push({ x: columns[cell.x], y: rows[cell.y] });
        cursor = previous.get(cursor);
      }
      if ((pathLength.get(current.key) ?? Infinity) <= maximumLength) return points.reverse();
      continue;
    }
    for (const [nextX, nextY, nextDirection] of [[x - 1, y, 1], [x + 1, y, 1], [x, y - 1, 2], [x, y + 1, 2]]) {
      if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= rows.length) continue;
      const from = { x: columns[x], y: rows[y] };
      const to = { x: columns[nextX], y: rows[nextY] };
      const nextLength = (pathLength.get(current.key) ?? 0) + Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      if (nextLength > maximumLength) continue;
      const candidate = segment(from, to);
      const cacheKey = `${Math.min(x, nextX)},${Math.min(y, nextY)},${nextDirection}`;
      let free = clear.get(cacheKey);
      if (free === undefined) {
        free = !blockedByNodes(candidate, obstacles);
        clear.set(cacheKey, free);
      }
      if (!free || parallelConflict(candidate, occupied)) continue;
      const crossings = crossingCount(candidate, occupied);
      const midpointX = (to.x + from.x) / 2;
      const midpointY = (to.y + from.y) / 2;
      const outer = midpointX < regionBounds.left - 80 || midpointX > regionBounds.right + 80 || midpointY < regionBounds.top - 80 || midpointY > regionBounds.bottom + 80;
      const overrun = Math.max(0, Math.hypot(to.x - start.x, to.y - start.y) - directDistance * 2);
      const cost = current.cost + Math.abs(to.x - from.x) + Math.abs(to.y - from.y) +
        overrun * 3 +
        (outer ? (Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) * 2 : 0) +
        (direction && direction !== nextDirection ? 28 : 0) + crossings * 240;
      const next = key(nextX, nextY, nextDirection);
      if (cost >= (distance.get(next) ?? Infinity)) continue;
      distance.set(next, cost);
      pathLength.set(next, nextLength);
      previous.set(next, current.key);
      queue.push({ key: next, cost, rank: cost + Math.abs(to.x - end.x) + Math.abs(to.y - end.y) });
    }
  }
  return null;
}

function simplify(points: Point[]) {
  const result: Point[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last && Math.abs(last.x - point.x) < EPSILON && Math.abs(last.y - point.y) < EPSILON) continue;
    const previous = result.at(-2);
    if (previous && last && (previous.x === last.x && last.x === point.x || previous.y === last.y && last.y === point.y)) result.pop();
    result.push(point);
  }
  return result;
}

function labelFor(text: string | undefined, points: Point[], nodes: Rect[], labels: Rect[], occupied: Segment[]):
  { x: number; y: number; width: number; height: number; text: string; crowded: boolean } | undefined {
  if (!text) return undefined;
  const width = Math.ceil(text.length * 6.8 + 16);
  const height = 22;
  const candidates = segments(points).map((part) => ({ part, length: Math.abs(part.second.x - part.first.x) + Math.abs(part.second.y - part.first.y) }))
    .sort((a, b) => b.length - a.length);
  if (!candidates.length) return undefined;
  const isShared = (part: Segment) => occupied.some((used) => used.horizontal === part.horizontal &&
    Math.abs((part.horizontal ? part.first.y : part.first.x) - (used.horizontal ? used.first.y : used.first.x)) < EPSILON &&
    overlap(part.horizontal ? part.first.x : part.first.y, part.horizontal ? part.second.x : part.second.y,
      used.horizontal ? used.first.x : used.first.y, used.horizontal ? used.second.x : used.second.y) > EPSILON);
  const part = candidates.find((candidate) => !isShared(candidate.part))?.part ?? candidates[0].part;
  const crowded = isShared(part);
  const length = Math.abs(part.second.x - part.first.x) + Math.abs(part.second.y - part.first.y);
  const horizontal = part.horizontal;
  if (length < (horizontal ? width : height) + 64) {
    return { x: (part.first.x + part.second.x) / 2, y: (part.first.y + part.second.y) / 2, width, height, text, crowded: true };
  }
  const midpoint = (horizontal ? (part.first.x + part.second.x) : (part.first.y + part.second.y)) / 2;
  const reach = horizontal ? width / 2 + 32 : height / 2 + 32;
  const low = Math.min(horizontal ? part.first.x : part.first.y, horizontal ? part.second.x : part.second.y) + reach;
  const high = Math.max(horizontal ? part.first.x : part.second.x, horizontal ? part.first.y : part.second.y) - reach;
  const positions = [midpoint, midpoint - 32, midpoint + 32, midpoint - 64, midpoint + 64].filter((value) => value >= low && value <= high);
  for (const position of positions) {
    const x = horizontal ? position : (part.first.x + part.second.x) / 2;
    const y = horizontal ? (part.first.y + part.second.y) / 2 : position;
    const box = { x: x - width / 2, y: y - height / 2, width, height };
    if (nodes.some((node) => intersects(box, node, CLEARANCE)) || labels.some((label) => intersects(box, label, 8))) continue;
    const nearCrossing = occupied.some((used) => used.horizontal !== part.horizontal && (() => {
      const horizontal = part.horizontal ? part : used;
      const vertical = part.horizontal ? used : part;
      const crossing = { x: vertical.first.x, y: horizontal.first.y };
      return crossing.x >= Math.min(horizontal.first.x, horizontal.second.x) &&
        crossing.x <= Math.max(horizontal.first.x, horizontal.second.x) &&
        crossing.y >= Math.min(vertical.first.y, vertical.second.y) &&
        crossing.y <= Math.max(vertical.first.y, vertical.second.y) && Math.hypot(crossing.x - x, crossing.y - y) < 32;
    })());
    if (nearCrossing || crowded) continue;
    return { x, y, width, height, text, crowded: false };
  }
  return { x: (part.first.x + part.second.x) / 2, y: (part.first.y + part.second.y) / 2, width, height, text, crowded: true };
}

function bridgesFor(points: Point[], occupied: Segment[]) {
  const crossings = segments(points).flatMap((part, index) => occupied.flatMap((used) => {
    if (part.horizontal === used.horizontal) return [];
    const horizontal = part.horizontal ? part : used;
    const vertical = part.horizontal ? used : part;
    const point = { x: vertical.first.x, y: horizontal.first.y };
    if (point.x < Math.min(horizontal.first.x, horizontal.second.x) || point.x > Math.max(horizontal.first.x, horizontal.second.x) ||
      point.y < Math.min(vertical.first.y, vertical.second.y) || point.y > Math.max(vertical.first.y, vertical.second.y)) return [];
    const length = Math.hypot(part.second.x - part.first.x, part.second.y - part.first.y);
    const distance = Math.hypot(point.x - part.first.x, point.y - part.first.y);
    const radius = Math.min(4, (distance - 1) / 2, (length - distance - 1) / 2);
    if (radius < 1) return [];
    return [{ segment: index, point, radius }];
  }));
  return crossings.filter((crossing) => crossings.filter((other) =>
    Math.hypot(crossing.point.x - other.point.x, crossing.point.y - other.point.y) <= 40).length < 3);
}

export function routeCanvasEdges(ideas: Idea[], links: CanvasLink[], measured: Record<string, { width: number; height: number } | undefined> = {}) {
  const nodes = new Map(ideas.map((idea) => {
    const size = measured[idea.id] ?? IDEA_CARD_SIZE;
    return [idea.id, { id: idea.id, ...idea.position, width: size.width, height: size.height }] as const;
  }));
  const ports = distributePorts(links, nodes);
  const obstacles = [...nodes.values()].map((node) => inflate(node, ROUTE_MARGIN));
  const occupied: Segment[] = [];
  const labels: Rect[] = [];
  const routes = new Map<string, EdgeRoute>();
  for (const link of links) {
    const source = ports.get(endpointKey(link.id, "source"));
    const target = ports.get(endpointKey(link.id, "target"));
    if (!source || !target) continue;
    const sourceNode = nodes.get(link.source);
    const targetNode = nodes.get(link.target);
    if (!sourceNode || !targetNode) continue;
    const start = outside(source.point, source.side);
    const end = outside(target.point, target.side);
    const bounds = {
      x: Math.min(sourceNode.x, targetNode.x) - 80,
      y: Math.min(sourceNode.y, targetNode.y) - 80,
      width: Math.max(sourceNode.x + sourceNode.width, targetNode.x + targetNode.width) - Math.min(sourceNode.x, targetNode.x) + 160,
      height: Math.max(sourceNode.y + sourceNode.height, targetNode.y + targetNode.height) - Math.min(sourceNode.y, targetNode.y) + 160,
    };
    const sourceCenter = center(sourceNode);
    const targetCenter = center(targetNode);
    const maximumRouteLength = 2 * Math.max(1, Math.abs(targetCenter.x - sourceCenter.x) + Math.abs(targetCenter.y - sourceCenter.y));
    const maximumInnerLength = maximumRouteLength - 2 * ROUTE_MARGIN;
    const routingObstacles = [...obstacles, ...labels.map((label) => inflate(label, 4))];
    const inner = maximumInnerLength > 0 ? routeGrid(start, end, routingObstacles, occupied, bounds, maximumInnerLength) ??
      routeGrid(start, end, routingObstacles, occupied, bounds, maximumInnerLength, true) : null;
    let curved = !inner;
    let points = inner ? simplify([source.point, ...inner, target.point]) : [source.point, target.point];
    const pathLength = segments(points).reduce((length, part) => length + Math.abs(part.second.x - part.first.x) + Math.abs(part.second.y - part.first.y), 0);
    if (pathLength > maximumRouteLength || points.some((point) => point.x < bounds.x || point.x > bounds.x + bounds.width || point.y < bounds.y || point.y > bounds.y + bounds.height)) {
      curved = true;
      points = [source.point, target.point];
    }
    const label = curved ? (link.label ? {
      x: (source.point.x + target.point.x) / 2, y: (source.point.y + target.point.y) / 2,
      width: Math.ceil(link.label.length * 6.8 + 16), height: 22, text: link.label, crowded: true,
    } : undefined) : labelFor(link.label, points, [...nodes.values()], labels, occupied);
    if (label) labels.push({ x: label.x - label.width / 2, y: label.y - label.height / 2, width: label.width, height: label.height });
    const route = {
      points, sourceSide: source.side, targetSide: target.side, curved,
      bridges: curved ? [] : bridgesFor(points, occupied),
      label,
      labelCrowded: Boolean(label && "crowded" in label && label.crowded),
    } satisfies EdgeRoute;
    routes.set(link.id, route);
    if (!curved) occupied.push(...segments(points));
  }
  return routes;
}

export function roundedEdgePath(route: EdgeRoute) {
  const { points, bridges } = route;
  if (points.length < 2) return "";
  if (route.curved) {
    const start = points[0];
    const end = points.at(-1)!;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const reach = Math.min(72, Math.max(28, distance / 3));
    const vectors: Record<Side, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
    const sourceVector = vectors[route.sourceSide];
    const targetVector = vectors[route.targetSide];
    const firstControl = { x: start.x + sourceVector.x * reach, y: start.y + sourceVector.y * reach };
    const secondControl = { x: end.x + targetVector.x * reach, y: end.y + targetVector.y * reach };
    return `M ${start.x} ${start.y} C ${firstControl.x} ${firstControl.y} ${secondControl.x} ${secondControl.y} ${end.x} ${end.y}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < EPSILON) continue;
    const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const entry = index === 0 ? 0 : Math.min(CORNER_RADIUS, length / 2, Math.hypot(start.x - points[index - 1].x, start.y - points[index - 1].y) / 2);
    const exit = index === points.length - 2 ? 0 : Math.min(CORNER_RADIUS, length / 2, Math.hypot(end.x - points[index + 2].x, end.y - points[index + 2].y) / 2);
    const usableStart = { x: start.x + unit.x * entry, y: start.y + unit.y * entry };
    const usableEnd = { x: end.x - unit.x * exit, y: end.y - unit.y * exit };
    if (index > 0) path += ` Q ${start.x} ${start.y} ${usableStart.x} ${usableStart.y}`;
    const crossings = bridges.filter((bridge) => bridge.segment === index).sort((a, b) =>
      ((a.point.x - start.x) * unit.x + (a.point.y - start.y) * unit.y) -
      ((b.point.x - start.x) * unit.x + (b.point.y - start.y) * unit.y));
    let lastDistance = entry;
    for (const bridge of crossings) {
      const distance = (bridge.point.x - start.x) * unit.x + (bridge.point.y - start.y) * unit.y;
      const radius = Math.min(bridge.radius, distance - lastDistance - 1, length - exit - distance - 1);
      if (radius < 1) continue;
      const before = { x: bridge.point.x - unit.x * radius, y: bridge.point.y - unit.y * radius };
      const after = { x: bridge.point.x + unit.x * radius, y: bridge.point.y + unit.y * radius };
      const high = { x: bridge.point.x + (unit.y || 1) * (radius + 2), y: bridge.point.y - (unit.x || 0) * (radius + 2) };
      path += ` L ${before.x} ${before.y} Q ${high.x} ${high.y} ${after.x} ${after.y}`;
      lastDistance = distance + radius;
    }
    path += ` L ${usableEnd.x} ${usableEnd.y}`;
  }
  return path;
}

export function orthogonalPreviewPath(start: Point, end: Point) {
  const points = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
    ? simplify([start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end])
    : simplify([start, { x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }, end]);
  return roundedEdgePath({ points, sourceSide: "right", targetSide: "left", bridges: [] });
}
