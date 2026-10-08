"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { assistantRequestSchema, assistantResponseSchema, type AssistantRequest } from "@/lib/assistant";
import { initialGoal } from "@/lib/ideas";
import type { Board, AssistantSourceSnapshot } from "./model";
import { assistantHistoryFor } from "./assistant-chat-history";
import { assistantActionIsCurrent, makeAssistantActionDraft, type AssistantActionDraft } from "./assistant-actions";
import { createIdeaId } from "./id";
import { MarkdownText } from "./markdown-text";

type ChatMessage =
  | { id: string; role: "user"; text: string; completed: boolean }
  | {
      id: string;
      role: "assistant";
      question: string;
      response: ReturnType<typeof assistantResponseSchema.parse>;
      snapshot: AssistantSourceSnapshot[];
    };

function textForHistory(message: ChatMessage): string {
  return message.role === "user" ? message.text : message.response.result.reply.map((paragraph) => paragraph.text).join("\n\n");
}

function historyFor(messages: ChatMessage[]): AssistantRequest["history"] {
  return assistantHistoryFor(messages.map((message) => message.role === "user"
    ? { role: "user", text: message.text, completed: message.completed }
    : { role: "assistant", text: textForHistory(message) }));
}

function responseError(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return fallback;
}

function AssistantActionCard({
  draft,
  board,
  active,
  onPreview,
  onUpdate,
  onAccept,
  onDiscard,
  onAskAgain,
  busy,
}: {
  draft: AssistantActionDraft;
  board: Board;
  active: boolean;
  onPreview: (draft: AssistantActionDraft) => void;
  onUpdate: (draft: AssistantActionDraft) => void;
  onAccept: (draft: AssistantActionDraft) => { ok: boolean; error?: string };
  onDiscard: (key: string) => void;
  onAskAgain: () => void;
  busy: boolean;
}) {
  const [current, setCurrent] = useState(draft);
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const stale = !assistantActionIsCurrent(board, current);

  function change(patch: Partial<AssistantActionDraft>) {
    const updated = { ...current, ...patch };
    setCurrent(updated);
    setError("");
    if (active) onUpdate(updated);
  }

  function accept() {
    if (!active || stale || accepted || pending) return;
    setPending(true);
    const result = onAccept(current);
    setPending(false);
    if (result.ok) setAccepted(true);
    else setError(result.error ?? "This action could not be applied.");
  }

  const sourceTitle = (id: string) => current.sources.find((source) => source.id === id)?.title || "Deleted idea";
  const title = current.action.kind === "create" ? "Create an idea"
    : current.action.kind === "edit" ? "Edit an idea"
      : current.action.kind === "link" ? "Add a relationship" : "Open a merge";
  const editCardId = current.action.kind === "edit" ? current.action.card : "";

  return <section className="board-assistant-action" aria-label={title}>
    <strong>{title}</strong>
    <MarkdownText>{current.action.why}</MarkdownText>
    {current.action.kind === "create" && <>
      <label>Proposed title<input maxLength={120} value={current.title} onChange={(event) => change({ title: event.target.value })} /></label>
      <label>Proposed content<textarea maxLength={4000} rows={3} value={current.content} onChange={(event) => change({ content: event.target.value })} /></label>
    </>}
    {current.action.kind === "edit" && <>
      <div className="board-assistant-edit-compare"><div><small>Current</small><span>{sourceTitle(editCardId)}</span><MarkdownText>{current.sources.find((source) => source.id === editCardId)?.content || "No description"}</MarkdownText></div>
        <div><small>Proposed</small><span>{current.title || "Untitled card"}</span><MarkdownText>{current.content || "No description"}</MarkdownText></div></div>
      <label>New title<input maxLength={120} value={current.title} onChange={(event) => change({ title: event.target.value })} /></label>
      <label>New content<textarea maxLength={4000} rows={3} value={current.content} onChange={(event) => change({ content: event.target.value })} /></label>
    </>}
    {current.action.kind === "link" && <>
      <p className="board-assistant-action-sources">{sourceTitle(current.source)} {current.type === "extends" ? "extends" : "↔"} {sourceTitle(current.target)}</p>
      {current.type === "extends" && <button type="button" className="board-assistant-direction" onClick={() => change({ source: current.target, target: current.source })}>Reverse extends direction</button>}
      <label>Relationship type<select value={current.type} onChange={(event) => change({ type: event.target.value as AssistantActionDraft["type"] })}>
        <option value="synergy">Works well together</option><option value="conflict">Conflicts with</option><option value="extends">Extends</option>
      </select></label>
      <label>Explanation<textarea rows={2} maxLength={1000} value={current.explanation} onChange={(event) => change({ explanation: event.target.value })} /></label>
      {current.type === "conflict" && <label>Conflict condition<textarea rows={2} maxLength={600} value={current.condition} onChange={(event) => change({ condition: event.target.value })} /></label>}
    </>}
    {current.action.kind === "merge" && <p className="board-assistant-action-sources">{sourceTitle(current.action.a)} + {sourceTitle(current.action.b)}</p>}
    {stale && <div className="board-chat-error" role="status"><p>A source card changed or was deleted. Ask again before accepting.</p>
      <button type="button" onClick={onAskAgain} disabled={busy}>Ask again with the current board</button></div>}
    {accepted && <p className="board-assistant-action-status" role="status">Accepted</p>}
    {active && !accepted && <p className="board-assistant-action-status" role="status">Preview shown on the canvas</p>}
    {error && <p className="board-chat-error" role="alert">{error}</p>}
    <div className="board-assistant-action-buttons">
      <button type="button" onClick={() => onPreview(current)} disabled={accepted || pending}>Preview</button>
      <button type="button" onClick={accept} disabled={!active || stale || accepted || pending}>{pending ? "Applying…" : "Accept"}</button>
      <button type="button" onClick={() => { onDiscard(current.key); setError(""); }} disabled={!active || pending}>Discard</button>
    </div>
  </section>;
}

export function ChatSidebar({
  open,
  onToggle,
  board,
  boardTitle,
  selectedCardId,
  onFocusCard,
  activeActionKey,
  onPreviewAction,
  onUpdatePreviewAction,
  onAcceptAction,
  onDiscardAction,
}: {
  open: boolean;
  onToggle: () => void;
  board: Board;
  boardTitle: string;
  selectedCardId: string | null;
  onFocusCard: (cardId: string) => void;
  activeActionKey: string | null;
  onPreviewAction: (draft: AssistantActionDraft) => void;
  onUpdatePreviewAction: (draft: AssistantActionDraft) => void;
  onAcceptAction: (draft: AssistantActionDraft) => { ok: boolean; error?: string };
  onDiscardAction: (key: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const prompts = ["Find connections between these ideas.", "Suggest a new direction.", "Help refine the selected idea."];

  useEffect(() => () => requestRef.current?.abort(), []);

  async function requestAssistant(messageText: string, clearComposer: boolean) {
    const message = messageText.trim();
    if (!message || busyRef.current) return;

    const userMessage: ChatMessage = { id: createIdeaId(), role: "user", text: message, completed: false };
    const request: AssistantRequest = {
      goal: board.goal?.trim() || boardTitle.trim() || initialGoal,
      cards: board.ideas.map(({ id, title, content, author }) => ({ id, title, content, ...(author ? { author } : {}) })),
      relationships: board.relationships.map(({ source, target, type, explanation, condition }) => ({
        source, target, type, explanation, ...(condition ? { condition } : {}),
      })),
      ...(selectedCardId && board.ideas.some((idea) => idea.id === selectedCardId) ? { selectedCardId } : {}),
      message,
      history: historyFor(messages),
    };
    const parsedRequest = assistantRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      setError(parsedRequest.error.issues[0]?.message ?? "The board is too large to send. Shorten some card text and try again.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessages((current) => [...current, userMessage]);
    if (clearComposer) setDraft("");
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 96_000);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(parsedRequest.data),
      });
      let payload: unknown;
      try { payload = await response.json(); }
      catch { throw new Error("The assistant returned an unreadable response. Try again."); }

      if (!response.ok) throw new Error(responseError(payload, "The assistant request failed. Try again."));
      const parsedResponse = assistantResponseSchema.safeParse(payload);
      if (!parsedResponse.success) throw new Error("The assistant returned an invalid response. Try again.");

      setMessages((current) => [...current.map((turn) => turn.id === userMessage.id && turn.role === "user"
        ? { ...turn, completed: true } : turn), {
          id: createIdeaId(),
          role: "assistant",
          question: message,
          response: parsedResponse.data,
          snapshot: parsedRequest.data.cards.map(({ id, title, content, author }) => ({ id, title, content, author: author || "Unknown contributor" })),
        }]);
    } catch (caught) {
      setError(controller.signal.aborted
        ? "The assistant request timed out. Try again."
        : caught instanceof Error ? caught.message : "The assistant request failed. Try again.");
      if (clearComposer) setDraft((current) => current || message);
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    await requestAssistant(draft, true);
  }

  return <aside hidden={!open} className={`board-chat ${open ? "open" : "closed"}`} aria-label="IdeaForge Assistant">
      <div className="board-chat-head"><div className="board-chat-mark" aria-hidden="true">✳</div><div><strong>IdeaForge Assistant</strong><small>AI answers from this board</small></div>
        <button className="board-icon-button" aria-label="Close AI helper" title="Close AI helper" onClick={onToggle}>×</button></div>
      <div className="board-chat-messages" aria-live="polite">
        {messages.length === 0 && <>
          <div className="board-assistant-message"><strong>Welcome to your idea space</strong><p>Ask about the board. The assistant will cite the cards behind each answer.</p></div>
          <p className="board-chat-caption">TRY A PROMPT</p>
          <div className="board-prompts">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>
        </>}
        {messages.map((message) => message.role === "user"
          ? <div key={message.id} className="board-message you">{message.text}</div>
          : <article key={message.id} className="board-message assistant">
            {message.response.result.reply.map((paragraph, index) => <div className="board-assistant-paragraph" key={`${message.id}-${index}`}>
              <MarkdownText>{paragraph.text}</MarkdownText>
              {paragraph.cites.length > 0 && <div className="board-citations" aria-label="Cited cards">
                {paragraph.cites.map((cardId) => {
                  const source = message.snapshot.find((card) => card.id === cardId);
                  const current = board.ideas.some((idea) => idea.id === cardId);
                  const label = source?.title.trim() || "Untitled card";
                  return <button
                    type="button"
                    key={cardId}
                    className={`board-citation ${current ? "" : "is-gone"}`}
                    disabled={!current}
                    aria-label={current ? `Focus cited card: ${label}` : `Cited card deleted: ${label}`}
                    title={current ? "Focus this card on the board" : "This card was deleted"}
                    onClick={() => onFocusCard(cardId)}
                  >{current ? label : `${label} · deleted`}</button>;
                })}
              </div>}
            </div>)}
            {message.response.result.actions.map((action, index) => {
              const key = `${message.id}:action:${index}`;
              const draft = makeAssistantActionDraft(key, action, message.snapshot, message.response.model, message.response.generatedAt);
              return <AssistantActionCard key={key} draft={draft} board={board} active={activeActionKey === key}
                onPreview={onPreviewAction} onUpdate={onUpdatePreviewAction} onAccept={onAcceptAction} onDiscard={onDiscardAction}
                onAskAgain={() => void requestAssistant(message.question, false)} busy={busy} />;
            })}
            <small className="board-assistant-attribution">AI-generated · {message.response.model}</small>
          </article>)}
        {busy && <p className="board-chat-status" role="status">Thinking about the board…</p>}
        {error && <p className="board-chat-error" role="alert">{error}</p>}
      </div>
      <form className="board-chat-compose" onSubmit={(event) => void send(event)}>
        <textarea aria-label="Message the assistant" placeholder="Ask about your ideas…" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} />
        <div><span>{busy ? "One request at a time" : "Your chat stays in this browser"}</span><button type="submit" disabled={!draft.trim() || busy}>{busy ? "Thinking…" : "Send ↑"}</button></div>
      </form>
  </aside>;
}
