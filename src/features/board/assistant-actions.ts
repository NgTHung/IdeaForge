import type { AssistantAction } from "@/lib/assistant";
import { createIdea, type AssistantSourceSnapshot, type Board, type Idea, type RelationshipType } from "./model";
import { ideaSnapshotsMatch, type IdeaSnapshot } from "./connection-preview";
import { relatedIdeaPosition } from "./merge-board";

export type AssistantActionDraft = {
  key: string;
  action: AssistantAction;
  sources: AssistantSourceSnapshot[];
  title: string;
  content: string;
  type: RelationshipType;
  explanation: string;
  condition: string;
  source: string;
  target: string;
  model: string;
  generatedAt: string;
};

export function assistantActionSourceIds(action: AssistantAction): string[] {
  switch (action.kind) {
    case "create": return [...new Set(action.basedOn)];
    case "edit": return [action.card];
    case "link": return [...new Set([action.source, action.target])];
    case "merge": return [...new Set([action.a, action.b])];
  }
}

export function makeAssistantActionDraft(
  key: string,
  action: AssistantAction,
  snapshot: AssistantSourceSnapshot[],
  model: string,
  generatedAt: string,
): AssistantActionDraft {
  const sources = assistantActionSourceIds(action).flatMap((id) => {
    const source = snapshot.find((card) => card.id === id);
    return source ? [source] : [];
  });
  const editedCard = action.kind === "edit" ? sources.find((source) => source.id === action.card) : undefined;
  return {
    key,
    action,
    sources,
    title: action.kind === "create" ? action.title : action.kind === "edit" ? action.title ?? editedCard?.title ?? "" : "",
    content: action.kind === "create" ? action.content : action.kind === "edit" ? action.content ?? editedCard?.content ?? "" : "",
    type: action.kind === "link" ? action.type : "synergy",
    explanation: action.kind === "link" ? action.explanation : "",
    condition: "",
    source: action.kind === "link" ? action.source : "",
    target: action.kind === "link" ? action.target : "",
    model,
    generatedAt,
  };
}

export function assistantActionIsCurrent(board: Board, draft: AssistantActionDraft): boolean {
  const snapshots: IdeaSnapshot[] = draft.sources.map(({ id, title, content }) => ({ id, title, content }));
  return snapshots.length === assistantActionSourceIds(draft.action).length && ideaSnapshotsMatch(snapshots, board.ideas);
}

export function acceptAssistantCreate(board: Board, draft: AssistantActionDraft, id: string, author: string): Board {
  if (draft.action.kind !== "create" || !assistantActionIsCurrent(board, draft) || board.ideas.some((idea) => idea.id === id)) return board;
  const title = draft.title.trim();
  const content = draft.content.trim();
  if (!title || title.length > 120 || title.length + content.length > 4000) return board;
  const parentIds = [...new Set(draft.action.basedOn)];
  const parents = parentIds.flatMap((parentId) => {
    const parent = board.ideas.find((idea) => idea.id === parentId);
    return parent ? [parent] : [];
  });
  if (!parents.length || parents.length !== parentIds.length) return board;
  const idea: Idea = {
    id,
    title,
    content,
    position: relatedIdeaPosition(board, parents),
    pinned: false,
    parentIds: parents.map(({ id: parentId }) => parentId),
    author,
    assistant: {
      sources: draft.sources,
      generated: { title: draft.action.title, content: draft.action.content },
      model: draft.model,
      generatedAt: draft.generatedAt,
    },
  };
  const next = createIdea(board, idea);
  return board.clusterSnapshot ? { ...next, clusterSnapshot: { ...board.clusterSnapshot, stale: true } } : next;
}
