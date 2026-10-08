import { z } from "zod";

export const MAX_ASSISTANT_CARDS = 100;
export const MAX_ASSISTANT_CARD_CHARACTERS = 4000;
export const MAX_ASSISTANT_TOTAL_CARD_CHARACTERS = 40000;
export const MAX_ASSISTANT_RELATIONSHIPS = 500;
export const MAX_ASSISTANT_RELATIONSHIP_EXPLANATION_CHARACTERS = 1000;
export const MAX_ASSISTANT_RELATIONSHIP_CONDITION_CHARACTERS = 600;
export const MAX_ASSISTANT_MESSAGE_CHARACTERS = 2000;
export const MAX_ASSISTANT_HISTORY_MESSAGES = 10;
export const MAX_ASSISTANT_HISTORY_MESSAGE_CHARACTERS = 6400;
export const MAX_ASSISTANT_CARD_ID_CHARACTERS = 100;
export const MAX_ASSISTANT_PARAGRAPH_CITES = 5;
export const MAX_ASSISTANT_ACTIONS = 3;

export const cardIdSchema = z.string().min(1).max(MAX_ASSISTANT_CARD_ID_CHARACTERS);
const relationshipTypeSchema = z.enum(["synergy", "conflict", "extends"]);

export const assistantRequestSchema = z.object({
  goal: z.string().trim().min(1).max(500),
  cards: z.array(z.object({
    id: cardIdSchema,
    title: z.string(),
    content: z.string(),
    author: z.string().max(100).optional(),
  }).strict()).max(MAX_ASSISTANT_CARDS),
  relationships: z.array(z.object({
    source: cardIdSchema,
    target: cardIdSchema,
    type: relationshipTypeSchema,
    explanation: z.string().max(MAX_ASSISTANT_RELATIONSHIP_EXPLANATION_CHARACTERS),
    condition: z.string().max(MAX_ASSISTANT_RELATIONSHIP_CONDITION_CHARACTERS).optional(),
  }).strict()).max(MAX_ASSISTANT_RELATIONSHIPS),
  selectedCardId: cardIdSchema.optional(),
  message: z.string().trim().min(1).max(MAX_ASSISTANT_MESSAGE_CHARACTERS),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(MAX_ASSISTANT_HISTORY_MESSAGE_CHARACTERS),
  }).strict()).max(MAX_ASSISTANT_HISTORY_MESSAGES).default([]),
}).strict().superRefine(({ cards, relationships, selectedCardId }, context) => {
  const cardIds = new Set(cards.map(({ id }) => id));
  if (cardIds.size !== cards.length) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Card IDs must be unique." });
  }

  let totalCardCharacters = 0;
  cards.forEach((card, index) => {
    const cardCharacters = card.title.length + card.content.length;
    totalCardCharacters += cardCharacters;
    if (cardCharacters > MAX_ASSISTANT_CARD_CHARACTERS) {
      context.addIssue({
        code: "custom",
        path: ["cards", index],
        message: "A card's title and content must total at most 4,000 characters.",
      });
    }
  });
  if (totalCardCharacters > MAX_ASSISTANT_TOTAL_CARD_CHARACTERS) {
    context.addIssue({ code: "custom", path: ["cards"], message: "Board card text must total at most 40,000 characters." });
  }

  relationships.forEach((relationship, index) => {
    if (relationship.source === relationship.target || !cardIds.has(relationship.source) || !cardIds.has(relationship.target)) {
      context.addIssue({
        code: "custom",
        path: ["relationships", index],
        message: "Each relationship must join two different cards in the request.",
      });
    }
  });
  if (selectedCardId !== undefined && !cardIds.has(selectedCardId)) {
    context.addIssue({ code: "custom", path: ["selectedCardId"], message: "The selected card must be in the request." });
  }
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

const actionWhy = z.string().trim().min(1).max(500);

export function assistantOutputSchema<T extends z.ZodType>(referenceSchema: T) {
  const createActionSchema = z.object({
    kind: z.literal("create"),
    why: actionWhy,
    title: z.string().trim().min(1).max(4000),
    content: z.string().trim().min(1).max(4000),
    basedOn: z.array(referenceSchema).min(1).max(4),
  }).strict();
  const editActionSchema = z.object({
    kind: z.literal("edit"),
    why: actionWhy,
    card: referenceSchema,
    title: z.string().trim().min(1).max(4000).optional(),
    content: z.string().trim().min(1).max(4000).optional(),
  }).strict().refine((action) => action.title !== undefined || action.content !== undefined, {
    message: "An edit must include a new title or content.",
  });
  const linkActionSchema = z.object({
    kind: z.literal("link"),
    why: actionWhy,
    source: referenceSchema,
    target: referenceSchema,
    type: relationshipTypeSchema,
    explanation: z.string().trim().min(1).max(1000),
  }).strict();
  const mergeActionSchema = z.object({
    kind: z.literal("merge"),
    why: actionWhy,
    a: referenceSchema,
    b: referenceSchema,
  }).strict();
  return z.object({
    reply: z.array(z.object({
      text: z.string().trim().min(1).max(800),
      cites: z.array(referenceSchema).max(MAX_ASSISTANT_PARAGRAPH_CITES),
    }).strict()).min(1).max(8),
    actions: z.array(z.discriminatedUnion("kind", [
      createActionSchema,
      editActionSchema,
      linkActionSchema,
      mergeActionSchema,
    ])).max(MAX_ASSISTANT_ACTIONS),
  }).strict();
}

export type AssistantAction =
  | { kind: "create"; why: string; title: string; content: string; basedOn: string[] }
  | { kind: "edit"; why: string; card: string; title?: string; content?: string }
  | { kind: "link"; why: string; source: string; target: string; type: "synergy" | "conflict" | "extends"; explanation: string }
  | { kind: "merge"; why: string; a: string; b: string };

export type AssistantResult = {
  reply: { text: string; cites: string[] }[];
  actions: AssistantAction[];
};

export const assistantResponseSchema = z.object({
  result: assistantOutputSchema(cardIdSchema),
  model: z.string().trim().min(1),
  generatedAt: z.iso.datetime(),
}).strict();

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;

export function aliasBoard(request: AssistantRequest) {
  const aliasToId = new Map<string, string>();
  const aliasToTitle = new Map<string, string>();
  const idToAlias = new Map<string, string>();
  request.cards.forEach(({ id }, index) => {
    const alias = "c" + (index + 1);
    aliasToId.set(alias, id);
    aliasToTitle.set(alias, request.cards[index].title || "Untitled card");
    idToAlias.set(id, alias);
  });

  return {
    payload: {
      goal: request.goal,
      cards: request.cards.map((card, index) => ({ ...card, id: "c" + (index + 1) })),
      relationships: request.relationships.map(({ source, target, ...relationship }) => ({
        ...relationship,
        source: idToAlias.get(source)!,
        target: idToAlias.get(target)!,
      })),
      selectedCard: request.selectedCardId ? idToAlias.get(request.selectedCardId)! : null,
      history: request.history,
      message: request.message,
    },
    aliasToId,
    aliasToTitle,
  };
}

function linkActionKey(source: string, target: string, type: "synergy" | "conflict" | "extends") {
  const endpoints = type === "extends" ? [source, target] : [source, target].sort();
  return JSON.stringify([type, ...endpoints]);
}

export function resolveAliases(
  output: AssistantResult,
  aliasToId: ReadonlyMap<string, string>,
  aliasToTitle: ReadonlyMap<string, string> = new Map(),
  existingRelationships: AssistantRequest["relationships"] = [],
): { result: AssistantResult; removed: { citations: number; actions: number } } {
  let removedCitations = 0;
  let removedActions = 0;
  const usedLinks = new Set(existingRelationships.map(({ source, target, type }) => linkActionKey(source, target, type)));
  const reply = output.reply.map(({ text, cites }) => {
    const seen = new Set<string>();
    const resolvedCites: string[] = [];
    for (const alias of cites) {
      const id = aliasToId.get(alias);
      if (!id || seen.has(id)) {
        removedCitations += 1;
        continue;
      }
      seen.add(id);
      resolvedCites.push(id);
    }
    const cleanText = text
      .replace(/\s*\(c\d+\)/gi, "")
      .replace(/\bc\d+\b/gi, (alias) => aliasToTitle.get(alias.toLowerCase()) ?? "a card");
    return { text: cleanText, cites: resolvedCites };
  });

  const actions: AssistantAction[] = [];
  for (const action of output.actions) {
    if (action.kind === "create") {
      const basedOn: string[] = [];
      for (const alias of action.basedOn) {
        const id = aliasToId.get(alias);
        if (id && !basedOn.includes(id)) basedOn.push(id);
      }
      if (!basedOn.length) {
        removedActions += 1;
        continue;
      }
      actions.push({ ...action, basedOn });
      continue;
    }
    if (action.kind === "edit") {
      const card = aliasToId.get(action.card);
      if (!card) {
        removedActions += 1;
        continue;
      }
      actions.push({ ...action, card });
      continue;
    }
    if (action.kind === "link") {
      const source = aliasToId.get(action.source);
      const target = aliasToId.get(action.target);
      if (!source || !target || source === target) {
        removedActions += 1;
        continue;
      }
      const key = linkActionKey(source, target, action.type);
      if (usedLinks.has(key)) {
        removedActions += 1;
        continue;
      }
      usedLinks.add(key);
      actions.push({ ...action, source, target });
      continue;
    }
    const a = aliasToId.get(action.a);
    const b = aliasToId.get(action.b);
    if (!a || !b || a === b) {
      removedActions += 1;
      continue;
    }
    actions.push({ ...action, a, b });
  }

  return { result: { reply, actions }, removed: { citations: removedCitations, actions: removedActions } };
}
