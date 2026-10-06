import { z } from "zod";

export const clusterCardSchema = z.object({
  id: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(4000),
});

export const clusterRequestSchema = z.object({
  cards: z.array(clusterCardSchema).min(2).max(50),
  clusterCount: z.number().int().min(2).max(10),
}).superRefine(({ cards, clusterCount }, context) => {
  const ids = new Set<string>();
  for (const [index, card] of cards.entries()) {
    if (ids.has(card.id)) context.addIssue({
      code: "custom", path: ["cards", index, "id"], message: "Card IDs must be unique.",
    });
    ids.add(card.id);
  }
  if (clusterCount > cards.length) context.addIssue({
    code: "custom", path: ["clusterCount"], message: "Group count cannot exceed the number of cards.",
  });
});

const clusterNameGroupRequestSchema = z.object({
  id: z.string().trim().min(1).max(100),
  representativeNoteId: z.string().trim().min(1).max(100),
  notes: z.array(clusterCardSchema).min(1).max(50),
}).superRefine((group, context) => {
  if (!group.notes.some((note) => note.id === group.representativeNoteId)) context.addIssue({
    code: "custom", path: ["representativeNoteId"], message: "The representative must belong to its group.",
  });
});

export const clusterNamesRequestSchema = z.object({
  revision: z.string().trim().min(1).max(100),
  groups: z.array(clusterNameGroupRequestSchema).min(2).max(10),
}).superRefine((request, context) => {
  const groupIds = new Set<string>();
  const noteIds = new Set<string>();
  let noteCount = 0;
  for (const [groupIndex, group] of request.groups.entries()) {
    if (groupIds.has(group.id)) context.addIssue({
      code: "custom", path: ["groups", groupIndex, "id"], message: "Group IDs must be unique.",
    });
    groupIds.add(group.id);
    for (const [noteIndex, note] of group.notes.entries()) {
      noteCount += 1;
      if (noteIds.has(note.id)) context.addIssue({
        code: "custom", path: ["groups", groupIndex, "notes", noteIndex, "id"], message: "Note IDs must be unique across groups.",
      });
      noteIds.add(note.id);
    }
  }
  if (noteCount < 2 || noteCount > 50) context.addIssue({
    code: "custom", path: ["groups"], message: "Provide 2 to 50 notes across all groups.",
  });
});

export const clusterNamesResponseSchema = z.object({
  revision: z.string().min(1).max(100),
  names: z.array(z.object({
    groupId: z.string().min(1).max(100),
    suggestedName: z.string().min(1).max(40).nullable(),
  })).min(2).max(10),
}).superRefine((response, context) => {
  const ids = new Set<string>();
  for (const [index, item] of response.names.entries()) {
    if (ids.has(item.groupId)) context.addIssue({
      code: "custom", path: ["names", index, "groupId"], message: "Group name IDs must be unique.",
    });
    ids.add(item.groupId);
  }
});

const clusterAssignmentGroupSchema = z.object({
  id: z.string().min(1),
  representativeNoteId: z.string().min(1),
  cards: z.array(clusterCardSchema).min(1).max(49),
}).superRefine((group, context) => {
  if (!group.cards.some((card) => card.id === group.representativeNoteId)) context.addIssue({ code: "custom", path: ["representativeNoteId"], message: "The representative must belong to its group." });
});

export const clusterAssignmentRequestSchema = z.object({
  newCard: clusterCardSchema,
  groups: z.array(clusterAssignmentGroupSchema).min(2).max(10),
  revision: z.string().min(1).max(100),
}).superRefine(({ newCard, groups }, context) => {
  const ids = new Set([newCard.id]);
  const groupIds = new Set<string>();
  let count = 1;
  for (const [groupIndex, group] of groups.entries()) {
    if (groupIds.has(group.id)) context.addIssue({ code: "custom", path: ["groups", groupIndex, "id"], message: "Group IDs must be unique." });
    groupIds.add(group.id);
    for (const [cardIndex, card] of group.cards.entries()) {
      count += 1;
      if (ids.has(card.id)) context.addIssue({ code: "custom", path: ["groups", groupIndex, "cards", cardIndex, "id"], message: "Card IDs must be unique." });
      ids.add(card.id);
    }
  }
  if (count > 50) context.addIssue({ code: "custom", path: ["groups"], message: "At most 50 notes can be assigned at once." });
});

const neighborSchema = z.object({ noteId: z.string(), similarity: z.number().finite().min(-1).max(1) });
const outsideNeighborSchema = neighborSchema.extend({ clusterId: z.string() });
const notePairSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  similarity: z.number().finite().min(-1).max(1),
  distance: z.number().finite().min(0).max(2),
});
const groupPairSchema = z.object({
  firstGroupId: z.string().min(1),
  secondGroupId: z.string().min(1),
  meanCrossSimilarity: z.number().finite().min(-1).max(1),
});
const groupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  noteIds: z.array(z.string()).min(1),
  size: z.number().int().positive(),
  representativeNoteId: z.string(),
  meanPairSimilarity: z.number().finite().min(-1).max(1).nullable(),
});
const assignmentSchema = z.object({
  noteId: z.string(),
  clusterId: z.string(),
  similarityToRepresentative: z.number().finite().min(-1).max(1),
  distanceToRepresentative: z.number().finite().min(0).max(2),
  closestMember: neighborSchema.nullable(),
  closestOutside: outsideNeighborSchema,
});

export const clusterResponseSchema = z.object({
  algorithm: z.literal("average_linkage"),
  scoreMethod: z.enum(["mean_centered_cosine", "nearest_neighbor_rank"]),
  embeddingModel: z.string().min(1),
  clusterCount: z.number().int().min(2).max(10),
  noteCount: z.number().int().min(2).max(50),
  groups: z.array(groupSchema).min(2).max(10),
  groupPairs: z.array(groupPairSchema).max(45),
  notePairs: z.array(notePairSchema).max(1225),
  assignments: z.array(assignmentSchema).min(2).max(50),
}).superRefine((result, context) => {
  if (result.groups.length !== result.clusterCount) context.addIssue({
    code: "custom", path: ["groups"], message: "Every requested group must be present.",
  });
  if (result.assignments.length !== result.noteCount) context.addIssue({
    code: "custom", path: ["assignments"], message: "Every card must have one assignment.",
  });
  const groupIds = new Set(result.groups.map((group) => group.id));
  const pairKeys = new Set<string>();
  for (const [index, pair] of result.groupPairs.entries()) {
    const key = [pair.firstGroupId, pair.secondGroupId].sort().join("\u0000");
    if (pair.firstGroupId === pair.secondGroupId || !groupIds.has(pair.firstGroupId) || !groupIds.has(pair.secondGroupId) || pairKeys.has(key)) {
      context.addIssue({ code: "custom", path: ["groupPairs", index], message: "Group pairs must uniquely name two different result groups." });
    }
    pairKeys.add(key);
  }
  if (pairKeys.size !== result.clusterCount * (result.clusterCount - 1) / 2) context.addIssue({
    code: "custom", path: ["groupPairs"], message: "Every unordered group pair must have one score.",
  });
  if (groupIds.size !== result.groups.length) context.addIssue({
    code: "custom", path: ["groups"], message: "Group IDs must be unique.",
  });
  const membership = new Map<string, string>();
  for (const group of result.groups) {
    if (group.size !== group.noteIds.length || !group.noteIds.includes(group.representativeNoteId)) context.addIssue({
      code: "custom", path: ["groups"], message: "Group size and representative must match its members.",
    });
    for (const id of group.noteIds) {
      if (membership.has(id)) context.addIssue({ code: "custom", path: ["groups"], message: "A card cannot belong to multiple groups." });
      membership.set(id, group.id);
    }
  }
  const assigned = new Set<string>();
  for (const assignment of result.assignments) {
    if (assigned.has(assignment.noteId)) context.addIssue({ code: "custom", path: ["assignments"], message: "Card assignments must be unique." });
    assigned.add(assignment.noteId);
    if (!groupIds.has(assignment.clusterId) || membership.get(assignment.noteId) !== assignment.clusterId) context.addIssue({
      code: "custom", path: ["assignments"], message: "Assignments must match group membership.",
    });
    if (assignment.closestMember && membership.get(assignment.closestMember.noteId) !== assignment.clusterId) context.addIssue({
      code: "custom", path: ["assignments"], message: "The closest member must belong to the same group.",
    });
    if (membership.get(assignment.closestOutside.noteId) !== assignment.closestOutside.clusterId) context.addIssue({
      code: "custom", path: ["assignments"], message: "The closest outside card must match its group.",
    });
    if (!groupIds.has(assignment.closestOutside.clusterId) || assignment.closestOutside.clusterId === assignment.clusterId) context.addIssue({
      code: "custom", path: ["assignments"], message: "The closest outside card must belong to another group.",
    });
    if (assignment.closestMember?.noteId === assignment.noteId) context.addIssue({
      code: "custom", path: ["assignments"], message: "A card cannot be its own closest member.",
    });
  }
  if (membership.size !== result.noteCount || [...membership.keys()].some((id) => !assigned.has(id))) context.addIssue({
    code: "custom", path: ["groups"], message: "Groups and assignments must cover the same cards.",
  });
  const notePairKeys = new Set<string>();
  for (const [index, pair] of result.notePairs.entries()) {
    const key = [pair.sourceId, pair.targetId].sort().join("\u0000");
    if (pair.sourceId === pair.targetId || !membership.has(pair.sourceId) || !membership.has(pair.targetId) || notePairKeys.has(key) ||
      Math.abs(pair.distance - (1 - pair.similarity)) > 1e-8) context.addIssue({
      code: "custom", path: ["notePairs", index], message: "Note pairs must uniquely name two cards with distance equal to one minus similarity.",
    });
    notePairKeys.add(key);
  }
  if (notePairKeys.size !== result.noteCount * (result.noteCount - 1) / 2) context.addIssue({
    code: "custom", path: ["notePairs"], message: "Every unordered note pair must have one score.",
  });
});

export const clusterAssignmentResponseSchema = z.object({
  revision: z.string().min(1),
  scoreMethod: z.enum(["mean_centered_cosine", "nearest_neighbor_rank"]),
  embeddingModel: z.string().min(1),
  newNoteId: z.string().min(1),
  noteCount: z.number().int().min(3).max(50),
  chosenGroupId: z.string().min(1),
  notePairs: z.array(notePairSchema).max(1225),
  groups: z.array(z.object({
    groupId: z.string().min(1),
    meanSimilarity: z.number().finite().min(-1).max(1),
    similarityToRepresentative: z.number().finite().min(-1).max(1),
    closestMember: neighborSchema,
  })).min(2).max(10),
}).superRefine((result, context) => {
  const ids = new Set(result.groups.map((group) => group.groupId));
  if (ids.size !== result.groups.length || !ids.has(result.chosenGroupId)) context.addIssue({
    code: "custom", path: ["groups"], message: "Assignment groups must be unique and include the chosen group.",
  });
  const members = new Set<string>();
  const keys = new Set<string>();
  for (const [index, pair] of result.notePairs.entries()) {
    const key = [pair.sourceId, pair.targetId].sort().join("\u0000");
    if (pair.sourceId === pair.targetId || keys.has(key) || Math.abs(pair.distance - (1 - pair.similarity)) > 1e-8) context.addIssue({
      code: "custom", path: ["notePairs", index], message: "Note pairs must be unique and carry the matching distance.",
    });
    keys.add(key);
    members.add(pair.sourceId);
    members.add(pair.targetId);
  }
  if (members.size !== result.noteCount || !members.has(result.newNoteId) || keys.size !== result.noteCount * (result.noteCount - 1) / 2) context.addIssue({
    code: "custom", path: ["notePairs"], message: "Every unordered note pair must have one score.",
  });
});

export const clusterSnapshotSchema = z.object({
  revision: z.string().min(1).max(100),
  stale: z.boolean(),
  result: clusterResponseSchema,
  bubbles: z.array(z.object({
    clusterId: z.string().min(1),
    label: z.string().min(1),
    size: z.number().int().positive(),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    centerX: z.number().finite(),
    centerY: z.number().finite(),
  })).min(2).max(10),
}).superRefine((snapshot, context) => {
  if (snapshot.bubbles.length !== snapshot.result.clusterCount || snapshot.bubbles.some((bubble) => !snapshot.result.groups.some((group) => group.id === bubble.clusterId))) {
    context.addIssue({ code: "custom", path: ["bubbles"], message: "Every result group needs one bubble." });
  }
});

export type ClusterCard = z.infer<typeof clusterCardSchema>;
export type ClusterRequest = z.infer<typeof clusterRequestSchema>;
export type ClusterResponse = z.infer<typeof clusterResponseSchema>;
export type ClusterNamesRequest = z.infer<typeof clusterNamesRequestSchema>;
export type ClusterNamesResponse = z.infer<typeof clusterNamesResponseSchema>;
export type ClusterAssignmentRequest = z.infer<typeof clusterAssignmentRequestSchema>;
export type ClusterAssignmentResponse = z.infer<typeof clusterAssignmentResponseSchema>;
export type ClusterSnapshot = z.infer<typeof clusterSnapshotSchema>;
