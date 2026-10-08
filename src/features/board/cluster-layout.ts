import type { ClusterAssignmentResponse, ClusterResponse } from "../../lib/cluster-contract";
import { IDEA_CARD_SIZE, ideaCardSize, type Idea } from "./model";

// The persisted `bubbles` field uses these invisible rectangular group bounds.
// Its name is retained so previously saved shared boards can be reorganized.
export type ClusterBubblePosition = {
  clusterId: string;
  label: string;
  size: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};
export type ClusterLayout = {
  positions: Map<string, { x: number; y: number }>;
  bubbles: ClusterBubblePosition[];
};

type Size = { width: number; height: number };
type Point = { x: number; y: number };
type Rect = Point & Size;
const CARD_GAP = 48;
const GROUP_PADDING = 54;

function overlaps(left: Rect, right: Rect) {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
}

function inflate(rect: Rect, amount: number): Rect {
  return { x: rect.x - amount, y: rect.y - amount, width: rect.width + amount * 2, height: rect.height + amount * 2 };
}

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function gridSpiral(stepX: number, stepY: number, limit: number): Point[] {
  const cells = [{ x: 0, y: 0 }];
  for (let radius = 1; cells.length < limit; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) cells.push({ x, y: -radius });
    for (let y = -radius + 1; y <= radius; y += 1) cells.push({ x: radius, y });
    for (let x = radius - 1; x >= -radius; x -= 1) cells.push({ x, y: radius });
    for (let y = radius - 1; y > -radius; y -= 1) cells.push({ x: -radius, y });
  }
  return cells.slice(0, limit).map((cell) => ({ x: cell.x * stepX, y: cell.y * stepY }));
}

function noteScoreMap(pairs: ClusterResponse["notePairs"] | ClusterAssignmentResponse["notePairs"]) {
  return new Map(pairs.map((pair) => [[pair.sourceId, pair.targetId].sort().join("\u0000"), pair.similarity]));
}

function scoreFor(scores: Map<string, number>, first: string, second: string) {
  return first === second ? 1 : scores.get([first, second].sort().join("\u0000")) ?? 0;
}

function normalized(value: number, minimum: number, maximum: number) {
  return maximum === minimum ? 0.5 : (value - minimum) / (maximum - minimum);
}

function noteRect(center: Point, size: Size): Rect {
  return { x: center.x - size.width / 2, y: center.y - size.height / 2, width: size.width, height: size.height };
}

function layoutGroup(group: ClusterResponse["groups"][number], ideas: Idea[], scores: Map<string, number>,
  measured: Record<string, Size | undefined>, connectedPairs: Set<string>) {
  const members = group.noteIds.map((id) => ideas.find((idea) => idea.id === id))
    .filter((idea): idea is Idea => Boolean(idea && !idea.pinned))
    .sort((left, right) => left.id.localeCompare(right.id));
  const anchorIdea = group.noteIds.map((id) => ideas.find((idea) => idea.id === id)).find((idea) => idea?.pinned);
  const fallbackSize = (idea: Idea) => ideaCardSize(idea, group.label);
  const anchor = anchorIdea ? {
    x: anchorIdea.position.x + (measured[anchorIdea.id] ?? fallbackSize(anchorIdea)).width / 2,
    y: anchorIdea.position.y + (measured[anchorIdea.id] ?? fallbackSize(anchorIdea)).height / 2,
  } : null;
  const groupSizes = group.noteIds.map((id) => ideas.find((idea) => idea.id === id)).filter((idea): idea is Idea => Boolean(idea)).map(fallbackSize);
  const groupSize = {
    width: Math.max(IDEA_CARD_SIZE.width, ...groupSizes.map((size) => size.width)),
    height: Math.max(IDEA_CARD_SIZE.height, ...groupSizes.map((size) => size.height)),
  };
  if (!members.length) return {
    group, positions: new Map<string, Point>(), width: groupSize.width + GROUP_PADDING * 2,
    height: groupSize.height + GROUP_PADDING * 2, anchor,
  };

  const sizes = new Map(members.map((idea) => [idea.id, measured[idea.id] ?? fallbackSize(idea)]));
  const allScores = members.flatMap((first, index) => members.slice(index + 1).map((second) => scoreFor(scores, first.id, second.id)));
  const minimum = Math.min(...allScores);
  const maximum = Math.max(...allScores);
  const target = (first: Idea, second: Idea) => {
    const a = sizes.get(first.id)!;
    const b = sizes.get(second.id)!;
    if (connectedPairs.has([first.id, second.id].sort().join("\u0000"))) {
      return Math.max((a.width + b.width) / 2, (a.height + b.height) / 2) + CARD_GAP;
    }
    return Math.max((a.width + b.width) / 2, (a.height + b.height) / 2) + CARD_GAP +
      (1 - normalized(scoreFor(scores, first.id, second.id), minimum, maximum)) * 190;
  };
  const maxWidth = Math.max(...members.map((idea) => sizes.get(idea.id)!.width));
  const maxHeight = Math.max(...members.map((idea) => sizes.get(idea.id)!.height));
  const initial = gridSpiral(maxWidth + 100, maxHeight + 100, members.length);
  const centers = members.map((idea, index) => ({ ...initial[index], id: idea.id }));

  for (let iteration = 0; iteration < 180; iteration += 1) {
    for (let first = 0; first < members.length; first += 1) {
      for (let second = first + 1; second < members.length; second += 1) {
        const a = centers[first];
        const b = centers[second];
        const angle = hash(`${a.id}\u0000${b.id}`) / 0xffffffff * Math.PI * 2;
        const dx = b.x - a.x || Math.cos(angle) * 0.001;
        const dy = b.y - a.y || Math.sin(angle) * 0.001;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const movement = Math.max(-14, Math.min(14, (distance - target(members[first], members[second])) * 0.045));
        a.x += dx / distance * movement / 2;
        a.y += dy / distance * movement / 2;
        b.x -= dx / distance * movement / 2;
        b.y -= dy / distance * movement / 2;
        const aSize = sizes.get(a.id)!;
        const bSize = sizes.get(b.id)!;
        const penetrationX = (aSize.width + bSize.width) / 2 + CARD_GAP - Math.abs(b.x - a.x);
        const penetrationY = (aSize.height + bSize.height) / 2 + CARD_GAP - Math.abs(b.y - a.y);
        if (penetrationX > 0 && penetrationY > 0) {
          if (penetrationX < penetrationY) {
            const push = Math.sign(b.x - a.x || Math.cos(angle)) * penetrationX / 2;
            a.x -= push; b.x += push;
          } else {
            const push = Math.sign(b.y - a.y || Math.sin(angle)) * penetrationY / 2;
            a.y -= push; b.y += push;
          }
        }
      }
    }
  }

  const placed = new Map<string, Point>();
  const offsets = gridSpiral(30, 30, 625);
  for (const [index, idea] of members.entries()) {
    const size = sizes.get(idea.id)!;
    const desired = centers[index];
    const candidates = offsets.map((offset) => ({ x: desired.x + offset.x, y: desired.y + offset.y }));
    const free = candidates.filter((candidate) => ![...placed].some(([id, point]) =>
      overlaps(inflate(noteRect(candidate, size), CARD_GAP / 2), inflate(noteRect(point, sizes.get(id)!), CARD_GAP / 2))));
    const best = free.map((candidate) => ({
      candidate,
      cost: Math.hypot(candidate.x - desired.x, candidate.y - desired.y) + [...placed].reduce((sum, [id, point]) => {
        const other = members.find((member) => member.id === id)!;
        return sum + Math.abs(Math.hypot(candidate.x - point.x, candidate.y - point.y) - target(idea, other)) * 0.35;
      }, 0),
    })).sort((left, right) => left.cost - right.cost)[0];
    placed.set(idea.id, best?.candidate ?? desired);
  }
  const rectangles = [...placed].map(([id, point]) => noteRect(point, sizes.get(id)!));
  const left = Math.min(...rectangles.map((rect) => rect.x));
  const right = Math.max(...rectangles.map((rect) => rect.x + rect.width));
  const top = Math.min(...rectangles.map((rect) => rect.y));
  const bottom = Math.max(...rectangles.map((rect) => rect.y + rect.height));
  const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
  return {
    group,
    positions: new Map([...placed].map(([id, point]) => [id, { x: point.x - center.x, y: point.y - center.y }])),
    width: right - left + GROUP_PADDING * 2,
    height: bottom - top + GROUP_PADDING * 2,
    anchor,
  };
}

export function layoutClusters(
  ideas: Idea[],
  result: ClusterResponse,
  measured: Record<string, Size | undefined> = {},
  connections: [string, string][] = [],
): ClusterLayout {
  const scores = noteScoreMap(result.notePairs);
  const connectedPairs = new Set(connections.map(([first, second]) => [first, second].sort().join("\u0000")));
  const groupForNote = new Map(result.assignments.map((assignment) => [assignment.noteId, assignment.clusterId]));
  const groupLabels = new Map(result.groups.map((group) => [group.id, group.label]));
  const sizeFor = (idea: Idea) => ideaCardSize(idea, groupLabels.get(groupForNote.get(idea.id) ?? ""));
  const groupLinks = new Map<string, number>();
  for (const [first, second] of connections) {
    const firstGroup = groupForNote.get(first);
    const secondGroup = groupForNote.get(second);
    if (!firstGroup || !secondGroup || firstGroup === secondGroup) continue;
    const key = [firstGroup, secondGroup].sort().join("\u0000");
    groupLinks.set(key, (groupLinks.get(key) ?? 0) + 1);
  }
  const groupScore = new Map(result.groupPairs.map((pair) => [[pair.firstGroupId, pair.secondGroupId].sort().join("\u0000"), pair.meanCrossSimilarity]));
  const pairValues = result.groupPairs.map((pair) => pair.meanCrossSimilarity);
  const minimum = Math.min(...pairValues);
  const maximum = Math.max(...pairValues);
  const ordered = [result.groups[0]];
  while (ordered.length < result.groups.length) {
    const previous = ordered.at(-1)!;
    const next = result.groups.filter((group) => !ordered.includes(group)).sort((left, right) =>
      ((groupLinks.get([previous.id, right.id].sort().join("\u0000")) ?? 0) * 10 + (groupScore.get([previous.id, right.id].sort().join("\u0000")) ?? 0)) -
      ((groupLinks.get([previous.id, left.id].sort().join("\u0000")) ?? 0) * 10 + (groupScore.get([previous.id, left.id].sort().join("\u0000")) ?? 0)) || left.id.localeCompare(right.id))[0];
    ordered.push(next);
  }
  const groupLayouts = ordered.map((group) => layoutGroup(group, ideas, scores, measured, connectedPairs));
  const assignedIds = new Set(result.assignments.map((item) => item.noteId));
  const fixed = ideas.filter((idea) => idea.pinned || !assignedIds.has(idea.id)).map((idea) => ({
    id: idea.id, ...idea.position, ...(measured[idea.id] ?? sizeFor(idea)),
  }));
  const columns = Math.ceil(Math.sqrt(groupLayouts.length));
  const placedRegions: Rect[] = [];
  const positions = new Map<string, Point>();
  const bubbles: ClusterBubblePosition[] = [];
  const search = gridSpiral(80, 80, 1800);
  let rowY = 160;
  let rowBottom = rowY;
  let previousInRow: (Rect & { groupId: string }) | null = null;
  for (const [index, layout] of groupLayouts.entries()) {
    if (index > 0 && index % columns === 0) {
      rowY = rowBottom + 230;
      rowBottom = rowY;
      previousInRow = null;
    }
    const similarity = previousInRow ? groupScore.get([previousInRow.groupId, layout.group.id].sort().join("\u0000")) ?? 0 : 0;
    const linkedGroupCount = previousInRow ? groupLinks.get([previousInRow.groupId, layout.group.id].sort().join("\u0000")) ?? 0 : 0;
    const gap = linkedGroupCount ? 120 : 220 + (1 - normalized(similarity, minimum, maximum)) * 150;
    const planned: Point = layout.anchor ? {
      x: layout.anchor.x - layout.width / 2,
      y: layout.anchor.y - layout.height / 2,
    } : {
      x: previousInRow ? previousInRow.x + previousInRow.width + gap : 160,
      y: rowY,
    };
    const ownPinned = new Set(layout.group.noteIds.filter((id) => ideas.find((idea) => idea.id === id)?.pinned));
    const candidates: Rect[] = search.map((offset) => ({ x: planned.x + offset.x, y: planned.y + offset.y, width: layout.width, height: layout.height }));
    const region: Rect = candidates.find((candidate) => {
      if (placedRegions.some((other) => overlaps(inflate(candidate, 70), inflate(other, 70)))) return false;
      if (fixed.some((other) => !ownPinned.has(other.id) && overlaps(candidate, inflate(other, 28)))) return false;
      return ![...layout.positions].some(([id, point]) => {
        const member = ideas.find((idea) => idea.id === id);
        const size = measured[id] ?? (member ? ideaCardSize(member, layout.group.label) : IDEA_CARD_SIZE);
        const rect = noteRect({ x: candidate.x + candidate.width / 2 + point.x, y: candidate.y + candidate.height / 2 + point.y }, size);
        return fixed.some((other) => overlaps(inflate(rect, CARD_GAP / 2), inflate(other, CARD_GAP / 2)));
      });
    }) ?? candidates[0];
    placedRegions.push(region);
    previousInRow = { ...region, groupId: layout.group.id };
    rowBottom = Math.max(rowBottom, region.y + region.height);
    for (const [id, point] of layout.positions) {
      const member = ideas.find((idea) => idea.id === id);
      const size = measured[id] ?? (member ? ideaCardSize(member, layout.group.label) : IDEA_CARD_SIZE);
      positions.set(id, {
        x: region.x + region.width / 2 + point.x - size.width / 2,
        y: region.y + region.height / 2 + point.y - size.height / 2,
      });
    }
    bubbles.push({
      clusterId: layout.group.id, label: layout.group.label, size: layout.group.size,
      ...region, centerX: region.x + region.width / 2, centerY: region.y + region.height / 2,
    });
  }
  return { positions, bubbles };
}

export function placeNewNote(
  idea: Idea,
  groupId: string,
  memberIds: string[],
  assignment: ClusterAssignmentResponse,
  bubble: ClusterBubblePosition,
  ideas: Idea[],
  measured: Record<string, Size | undefined> = {},
  otherBubbles: ClusterBubblePosition[] = [],
): { position: Idea["position"]; bubble: ClusterBubblePosition } | null {
  const group = assignment.groups.find((item) => item.groupId === groupId);
  const member = ideas.find((candidate) => candidate.id === group?.closestMember.noteId);
  if (!group || !member) return null;
  const members = memberIds.map((id) => ideas.find((candidate) => candidate.id === id)).filter((candidate): candidate is Idea => Boolean(candidate));
  const size = measured[idea.id] ?? ideaCardSize(idea, bubble.label);
  const memberSize = measured[member.id] ?? ideaCardSize(member, bubble.label);
  const origin = { x: member.position.x + memberSize.width / 2, y: member.position.y + memberSize.height / 2 };
  const obstacles = ideas.filter((candidate) => candidate.id !== idea.id).map((candidate) => ({
    ...candidate.position, ...(measured[candidate.id] ?? ideaCardSize(candidate, memberIds.includes(candidate.id) ? bubble.label : undefined)),
  }));
  const scores = noteScoreMap(assignment.notePairs);
  const memberScores = members.map((candidate) => scoreFor(scores, idea.id, candidate.id));
  const minimum = Math.min(...memberScores);
  const maximum = Math.max(...memberScores);
  const candidates = gridSpiral(Math.max(45, size.width / 4), Math.max(45, size.height / 3), 2500);
  const choices = candidates.flatMap((offset) => {
    const center = { x: origin.x + offset.x, y: origin.y + offset.y };
    const rect = noteRect(center, size);
    if (obstacles.some((obstacle) => overlaps(inflate(rect, CARD_GAP / 2), inflate(obstacle, CARD_GAP / 2)))) return [];
    const margin = GROUP_PADDING;
    const left = Math.min(bubble.x, rect.x - margin);
    const top = Math.min(bubble.y, rect.y - margin);
    const right = Math.max(bubble.x + bubble.width, rect.x + rect.width + margin);
    const bottom = Math.max(bubble.y + bubble.height, rect.y + rect.height + margin);
    const expanded = {
      ...bubble, x: left, y: top, width: right - left, height: bottom - top,
      centerX: (left + right) / 2, centerY: (top + bottom) / 2, size: bubble.size + 1,
    };
    if (otherBubbles.some((other) => other.clusterId !== groupId && overlaps(inflate(expanded, 50), inflate(other, 50)))) return [];
    const pairCost = members.reduce((total, candidate) => {
      const candidateSize = measured[candidate.id] ?? ideaCardSize(candidate, memberIds.includes(candidate.id) ? bubble.label : undefined);
      const similarity = scoreFor(scores, idea.id, candidate.id);
      const target = Math.max((size.width + candidateSize.width) / 2, (size.height + candidateSize.height) / 2) + CARD_GAP +
        (1 - normalized(similarity, minimum, maximum)) * 190;
      const distance = Math.hypot(center.x - candidate.position.x - candidateSize.width / 2,
        center.y - candidate.position.y - candidateSize.height / 2);
      return total + Math.abs(distance - target) * (0.5 + normalized(similarity, minimum, maximum));
    }, 0);
    const growth = (expanded.width * expanded.height - bubble.width * bubble.height) / 1000;
    return [{ position: { x: rect.x, y: rect.y }, bubble: expanded, cost: pairCost + growth }];
  }).sort((left, right) => left.cost - right.cost);
  return choices[0] ?? null;
}
