"use client";

import { useEffect, useState, type CSSProperties } from "react";
import "./starter-ideas-loading.css";

// The messages follow the generation prompt's stages. The route reports no progress, so they rotate on a timer.
const messages = [
  "Reading the board title and description…",
  "Exploring a dozen different approaches…",
  "Keeping one idea per mechanism…",
  "Writing short descriptions…",
];
const messageInterval = 2800;

export function StarterIdeasLoading() {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % messages.length), messageInterval);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="starter-ideas-loading" role="status">
    <div className="starter-ideas-loading-cards" aria-hidden="true">
      {Array.from({ length: 5 }, (_, card) => <span key={card} style={{ "--card": card } as CSSProperties}><i /><i /><i /></span>)}
    </div>
    <h2>Generating five starting ideas</h2>
    <p key={index} className="starter-ideas-loading-message" aria-hidden="true">{messages[index]}</p>
    {elapsed >= 5 && <small aria-hidden="true">{elapsed}s · You can look around while you wait.</small>}
  </div>;
}
