import type { ConclusionDraft, ConclusionNote, ConclusionRequest } from "@/lib/conclusion";
import { initialGoal } from "@/lib/ideas";
import type { Board, BoardConclusion, Idea } from "./model.ts";

export type ConclusionSelection = { ideaIds: string[]; clusterIds: string[] };
export type ConclusionCluster = { id: string; name: string; noteIds: string[] };

// Clusters come from the saved Organize result, limited to cards that still exist.
export function conclusionClusters(board: Board): ConclusionCluster[] {
  const existing = new Set(board.ideas.map((idea) => idea.id));
  return (board.clusterSnapshot?.result.groups ?? []).map((group) => ({
    id: group.id, name: group.label, noteIds: group.noteIds.filter((id) => existing.has(id)),
  })).filter((cluster) => cluster.noteIds.length > 0);
}

function noteFor(idea: Idea): ConclusionNote | null {
  const title = idea.title.trim();
  if (title.toLowerCase() === "new idea" && !idea.content.trim()) return null;
  const text = idea.content.trim() || title;
  if (!text) return null;
  const merge = idea.merge;
  return {
    id: idea.id,
    title: title.slice(0, 120),
    text,
    author: (idea.author?.trim() || "Unknown contributor").slice(0, 80),
    ...(merge ? { merge: {
      bridge: merge.proposal.bridge,
      tension: merge.proposal.tension,
      assumptions: merge.proposal.assumptions,
      nextExperiment: merge.proposal.nextExperiment,
      sources: merge.sources.map((source) => ({
        id: source.id, title: source.title.trim().slice(0, 120), author: source.author.slice(0, 80), text: source.content.trim() || source.title.trim(),
      })),
    } } : {}),
  };
}

// Builds the request for a selection. The fingerprint changes when any selected text, author, cluster, link, or the goal changes.
export function conclusionContext(board: Board, selection: ConclusionSelection): { request: ConclusionRequest; fingerprint: string } | null {
  const ideaById = new Map(board.ideas.map((idea) => [idea.id, idea]));
  const chosenClusterIds = new Set(selection.clusterIds);
  const clusters = conclusionClusters(board).filter((cluster) => chosenClusterIds.has(cluster.id));
  const notes = new Map<string, ConclusionNote>();
  for (const id of [...clusters.flatMap((cluster) => cluster.noteIds), ...board.ideas.map((idea) => idea.id).filter((id) => selection.ideaIds.includes(id))]) {
    const idea = ideaById.get(id);
    const note = idea && !notes.has(id) ? noteFor(idea) : null;
    if (note) notes.set(id, note);
  }
  if (!notes.size) return null;
  const request: ConclusionRequest = {
    goal: board.goal === undefined ? initialGoal : board.goal.trim(),
    notes: [...notes.values()],
    clusters: clusters.map((cluster) => ({ ...cluster, noteIds: cluster.noteIds.filter((id) => notes.has(id)) }))
      .filter((cluster) => cluster.noteIds.length > 0),
    relationships: board.relationships.filter((link) => notes.has(link.source) && notes.has(link.target) && link.source !== link.target)
      .map((link) => ({
        id: link.id, type: link.type, explanation: link.explanation, sourceId: link.source, targetId: link.target,
        ...(link.condition ? { condition: link.condition } : {}),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  return { request, fingerprint: JSON.stringify(request) };
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]#<>|])/g, "\\$1");
}

type CardName = { title: string; author: string };

// Selected notes win over merge parents that share an ID, because they carry the current text.
function cardNames(request: ConclusionRequest): Map<string, CardName> {
  const names = new Map<string, CardName>();
  for (const note of request.notes) {
    for (const source of note.merge?.sources ?? []) names.set(source.id, { title: source.title || "Untitled idea", author: source.author || "Unknown contributor" });
  }
  for (const note of request.notes) names.set(note.id, { title: note.title || "Untitled idea", author: note.author });
  return names;
}

function citationText(ids: string[], names: Map<string, CardName>): string {
  const cited = [...new Set(ids)].flatMap((id) => names.get(id) ?? []);
  return cited.length ? `Cards: ${cited.map((card) => `${escapeMarkdown(card.title)} (${escapeMarkdown(card.author)})`).join(", ")}` : "";
}

// Renders a draft as editable Markdown, naming cited cards by title and author instead of ID.
export function conclusionMarkdown(draft: ConclusionDraft, request: ConclusionRequest): string {
  const names = cardNames(request);
  const titleOf = (id: string) => escapeMarkdown(names.get(id)?.title ?? "Untitled idea");
  const withCards = (text: string, ids: string[]) => {
    const cards = citationText(ids, names);
    return cards ? `${text} (${cards})` : text;
  };
  const sections = [draft.summary, "## Themes", ...draft.themes.flatMap((theme) => {
    const cards = citationText(theme.cardIds, names);
    return [`### ${escapeMarkdown(theme.title)}`, theme.text, ...(cards ? [cards] : [])];
  })];
  sections.push("## Key ideas", draft.keyIdeas.map((idea) => {
    const card = names.get(idea.cardId);
    return `- **${titleOf(idea.cardId)}**${card ? ` (${escapeMarkdown(card.author)})` : ""}: ${idea.why}`;
  }).join("\n"));
  if (draft.conflicts.length) {
    sections.push("## Conflicts", draft.conflicts.map((conflict) => {
      const link = request.relationships.find((item) => item.id === conflict.relationshipId);
      const pair = link ? `**${titleOf(link.sourceId)} and ${titleOf(link.targetId)}**` : "**Conflict**";
      return `- ${pair}, ${conflict.handling === "addressed" ? "resolved" : "open question"}: ${conflict.text}`;
    }).join("\n"));
  }
  if (draft.assumptions.length) sections.push("## Assumptions", draft.assumptions.map((item) => `- ${withCards(item.text, item.cardIds)}`).join("\n"));
  if (draft.openQuestions.length) sections.push("## Open questions", draft.openQuestions.map((item) => `- ${withCards(item.text, item.cardIds)}`).join("\n"));
  sections.push("## Next steps", draft.nextSteps.map((step, index) => `${index + 1}. ${withCards(step.text, step.cardIds)}`).join("\n"));
  return sections.join("\n\n");
}

export function conclusionRecord(
  draft: { request: ConclusionRequest; result: ConclusionDraft; model: string; generatedAt: string },
  edited: { title: string; markdown: string },
  keptBy: string,
  keptAt: string,
): BoardConclusion {
  return {
    version: 1,
    title: edited.title.trim(),
    markdown: edited.markdown.trim(),
    generated: draft.result,
    request: draft.request,
    model: draft.model,
    generatedAt: draft.generatedAt,
    keptBy: keptBy.trim() || "Unknown contributor",
    keptAt,
  };
}

// Only the conclusion changes; ideas, merge snapshots, clusters, and votes stay as they are.
export function setBoardConclusion(board: Board, conclusion: BoardConclusion | null): Board {
  return { ...board, conclusion };
}

export function conclusionExportMarkdown(conclusion: BoardConclusion, boardTitle: string): string {
  const { request } = conclusion;
  const line = (id: string) => {
    const note = request.notes.find((item) => item.id === id);
    return note ? `- ${escapeMarkdown(note.title || "Untitled idea")} (${escapeMarkdown(note.author)})` : "";
  };
  const clustered = new Set(request.clusters.flatMap((cluster) => cluster.noteIds));
  const sources = [
    ...request.clusters.flatMap((cluster) => [`### Cluster: ${escapeMarkdown(cluster.name)}`, cluster.noteIds.map(line).filter(Boolean).join("\n")]),
    ...(request.notes.some((note) => !clustered.has(note.id)) ? [
      request.clusters.length ? "### Other selected ideas" : "### Selected ideas",
      request.notes.filter((note) => !clustered.has(note.id)).map((note) => line(note.id)).join("\n"),
    ] : []),
  ];
  return [
    `# ${escapeMarkdown(conclusion.title)}`,
    [`Board: ${escapeMarkdown(boardTitle.trim() || "Untitled board")}`, `Goal: ${escapeMarkdown(request.goal)}`,
      `Kept by ${escapeMarkdown(conclusion.keptBy)} on ${conclusion.keptAt.slice(0, 10)}`].join("  \n"),
    conclusion.markdown,
    "## Sources",
    ...sources,
  ].join("\n\n") + "\n";
}

export function conclusionFileName(boardTitle: string): string {
  const slug = boardTitle.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${slug || "board"}-conclusion.md`;
}
