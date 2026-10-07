import type { Board } from "./model";

export const initialBoard: Board = {
  goal: "Help students build a consistent study habit.",
  ideas: [
    { id: "study-rooms", title: "Shared study rooms", content: "Small rooms where students can study together, in person or online.", position: { x: 60, y: 80 }, pinned: false, parentIds: [] },
    { id: "peer-matching", title: "Peer matching", content: "Match students by subject, availability, and study goals.", position: { x: 430, y: 20 }, pinned: false, parentIds: [] },
    { id: "scheduling", title: "Session scheduling", content: "Find a time that works for a group without a long message thread.", position: { x: 800, y: 110 }, pinned: false, parentIds: [] },
    { id: "check-ins", title: "Progress check-ins", content: "A short weekly check-in helps study partners stay accountable.", position: { x: 250, y: 360 }, pinned: false, parentIds: [] },
    { id: "summaries", title: "AI session summaries", content: "A future assistant could summarize decisions and next steps after a session.", position: { x: 720, y: 410 }, pinned: false, parentIds: [] },
  ],
  relationships: [
    { id: "rooms-peers", source: "study-rooms", target: "peer-matching", type: "synergy", explanation: "Matched peers can meet in a shared room." },
    { id: "schedules-rooms", source: "scheduling", target: "study-rooms", type: "extends", explanation: "Scheduling adds a way to book room sessions." },
  ],
};
