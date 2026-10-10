"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { ThinkingAnimation } from "./board-activity";
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
      : current.action.kind === "link" ? "Add a link" : "Open a merge";
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
        <div><small>Proposed</small><span>{current.title || "Untitled idea"}</span><MarkdownText>{current.content || "No description"}</MarkdownText></div></div>
      <label>New title<input maxLength={120} value={current.title} onChange={(event) => change({ title: event.target.value })} /></label>
      <label>New content<textarea maxLength={4000} rows={3} value={current.content} onChange={(event) => change({ content: event.target.value })} /></label>
    </>}
    {current.action.kind === "link" && <>
      <p className="board-assistant-action-sources">{sourceTitle(current.source)} {current.type === "extends" ? "extends" : "↔"} {sourceTitle(current.target)}</p>
      {current.type === "extends" && <button type="button" className="board-assistant-direction" onClick={() => change({ source: current.target, target: current.source })}>Reverse extends direction</button>}
      <label>Link type<select value={current.type} onChange={(event) => change({ type: event.target.value as AssistantActionDraft["type"] })}>
        <option value="synergy">Works well together</option><option value="conflict">Conflicts with</option><option value="extends">Extends</option>
      </select></label>
      <label>Explanation<textarea rows={2} maxLength={1000} value={current.explanation} onChange={(event) => change({ explanation: event.target.value })} /></label>
      {current.type === "conflict" && <label>Conflict condition<textarea rows={2} maxLength={600} value={current.condition} onChange={(event) => change({ condition: event.target.value })} /></label>}
    </>}
    {current.action.kind === "merge" && <p className="board-assistant-action-sources">{sourceTitle(current.action.a)} + {sourceTitle(current.action.b)}</p>}
    {stale && <div className="board-chat-error" role="status"><p>A source idea changed or was deleted. Ask again before accepting.</p>
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
  const panelRef = useRef<HTMLElement>(null);
  const resizeStart = useRef<{ pointerId: number; x: number; y: number; width: number; height: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const prompts = ["Find links between these ideas.", "Suggest a new direction.", "Help refine the selected idea."];

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!open) {
      panelRef.current?.style.removeProperty("width");
      panelRef.current?.style.removeProperty("height");
      resizeStart.current = null;
    }
  }, [open]);

  function applyPanelSize(size: { width: number; height: number }) {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.width = `${size.width}px`;
    panel.style.height = `${size.height}px`;
  }

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    const panel = panelRef.current;
    if (!panel) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = panel.getBoundingClientRect();
    resizeStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height };
  }

  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    const start = resizeStart.current;
    const panel = panelRef.current;
    if (!start || start.pointerId !== event.pointerId || !panel) return;
    const workspace = panel.parentElement?.getBoundingClientRect();
    const maxWidth = Math.max(200, (workspace?.width ?? window.innerWidth) - 76);
    const maxHeight = Math.max(280, (workspace?.height ?? window.innerHeight) - 180);
    const minWidth = Math.min(280, maxWidth);
    const minHeight = Math.min(300, maxHeight);
    applyPanelSize({
      width: Math.round(Math.max(minWidth, Math.min(maxWidth, start.width + start.x - event.clientX))),
      height: Math.round(Math.max(minHeight, Math.min(maxHeight, start.height + event.clientY - start.y))),
    });
  }

  function stopResize(event: PointerEvent<HTMLButtonElement>) {
    if (resizeStart.current?.pointerId === event.pointerId) resizeStart.current = null;
  }

  function resizeByKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const bounds = panel.getBoundingClientRect();
    const workspace = panel.parentElement?.getBoundingClientRect();
    const maxWidth = Math.max(200, (workspace?.width ?? window.innerWidth) - 76);
    const maxHeight = Math.max(280, (workspace?.height ?? window.innerHeight) - 180);
    const minWidth = Math.min(280, maxWidth);
    const minHeight = Math.min(300, maxHeight);
    const delta = event.shiftKey ? 48 : 20;
    applyPanelSize({
      width: Math.round(Math.max(minWidth, Math.min(maxWidth, bounds.width + (event.key === "ArrowLeft" ? delta : event.key === "ArrowRight" ? -delta : 0)))),
      height: Math.round(Math.max(minHeight, Math.min(maxHeight, bounds.height + (event.key === "ArrowDown" ? delta : event.key === "ArrowUp" ? -delta : 0)))),
    });
  }

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
      setError(parsedRequest.error.issues[0]?.message ?? "The board is too large to send. Shorten some idea text and try again.");
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

  return <aside ref={panelRef} hidden={!open} className={`board-chat ${open ? "open" : "closed"}`} aria-label="Assistant">
      <div className="board-chat-head"><div className="board-chat-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></svg></div><div><strong>Assistant</strong></div>
        <button className="board-icon-button" aria-label="Close Assistant" title="Close Assistant" onClick={onToggle}>×</button></div>
      <div className="board-chat-messages" aria-live="polite">
        {messages.length === 0 && <>
          <p className="board-chat-privacy">Your chat stays in this browser.</p>
          <div className="board-prompts">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>
        </>}
        {messages.map((message) => message.role === "user"
          ? <div key={message.id} className="board-message you">{message.text}</div>
          : <article key={message.id} className="board-message assistant">
            {message.response.result.reply.map((paragraph, index) => <div className="board-assistant-paragraph" key={`${message.id}-${index}`}>
              <MarkdownText>{paragraph.text}</MarkdownText>
              {paragraph.cites.length > 0 && <div className="board-citations" aria-label="Cited ideas">
                {paragraph.cites.map((cardId) => {
                  const source = message.snapshot.find((card) => card.id === cardId);
                  const current = board.ideas.some((idea) => idea.id === cardId);
                  const label = source?.title.trim() || "Untitled idea";
                  return <button
                    type="button"
                    key={cardId}
                    className={`board-citation ${current ? "" : "is-gone"}`}
                    disabled={!current}
                    aria-label={current ? `Focus cited idea: ${label}` : `Cited idea deleted: ${label}`}
                    title={current ? "Focus this idea on the board" : "This idea was deleted"}
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
        {busy && <p className="board-chat-status" role="status"><ThinkingAnimation />Thinking about the board…</p>}
        {error && <p className="board-chat-error" role="alert">{error}</p>}
      </div>
      <form className="board-chat-compose" onSubmit={(event) => void send(event)}>
        <textarea aria-label="Message the assistant" placeholder="Ask about your ideas…" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} />
        <div><button type="submit" disabled={!draft.trim() || busy}>{busy ? "Thinking…" : "Send"}</button></div>
      </form>
      <button type="button" className="board-chat-resize" aria-label="Resize Assistant. Use arrow keys to resize; hold Shift for larger steps."
        title="Drag to resize · Arrow keys also work" onPointerDown={startResize} onPointerMove={moveResize}
        onPointerUp={stopResize} onPointerCancel={stopResize} onKeyDown={resizeByKeyboard}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 17 17 7M11 17l6-6M15 17l2-2" /></svg>
      </button>
  </aside>;
}
