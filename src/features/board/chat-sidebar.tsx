"use client";

import { useState, type FormEvent } from "react";
import { createIdeaId } from "./id";

export function ChatSidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<{ id: string; from: "you" | "assistant"; text: string }[]>([]);
  const prompts = ["Find connections between these ideas.", "Suggest a new direction.", "Help refine the selected idea."];
  function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setMessages((current) => [...current,
      { id: createIdeaId(), from: "you", text: draft.trim() },
      { id: createIdeaId(), from: "assistant", text: "This is a local demo. AI integration is coming later, so I haven't analyzed or changed your board." },
    ]);
    setDraft("");
  }
  return <aside className={`board-chat ${open ? "open" : "closed"}`} aria-label="IdeaForge Assistant">
    <div className="board-chat-head"><div className="board-chat-mark">✳</div>{open && <div><strong>IdeaForge Assistant</strong><small>Demo — AI not connected</small></div>}
      <button className="board-icon-button" aria-label={open ? "Collapse assistant" : "Expand assistant"} title={open ? "Collapse assistant" : "Expand assistant"} onClick={onToggle}>{open ? "›" : "‹"}</button></div>
    {open && <><div className="board-chat-messages"><div className="board-assistant-message"><strong>Welcome to your idea space</strong><p>Capture a thought, connect it to another, and see where your team could take it.</p></div>
      <p className="board-chat-caption">TRY A PROMPT</p><div className="board-prompts">{prompts.map((prompt) => <button key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>
      {messages.map((message) => <div key={message.id} className={`board-message ${message.from}`}>{message.text}</div>)}</div>
      <form className="board-chat-compose" onSubmit={send}><textarea aria-label="Message the demo assistant" placeholder="Ask the assistant…" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} />
        <div><span>Local placeholder</span><button type="submit" disabled={!draft.trim()}>Send ↑</button></div></form></>}
  </aside>;
}
