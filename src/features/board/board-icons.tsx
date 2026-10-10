const paths = {
  select: <path d="M5.5 3.5 18.5 10l-6 1.9-2.8 6.1L5.5 3.5Z" />,
  pan: <path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />,
  add: <><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M12 8.5v7M8.5 12h7" /></>,
  connect: <><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="6.5" r="2.5" /><path d="M8.5 15.5h3.5V8.5h3.5" /></>,
  merge: <path d="M6 3.5v3.5c0 3.5 6 4.5 6 8.5v5M18 3.5v3.5c0 3.5-6 4.5-6 8.5M9 17.5l3 3 3-3" />,
  organize: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  pencil: <><path d="m4 16.5-.9 4.4 4.4-.9L19.8 7.7a2.1 2.1 0 0 0-3-3L4 16.5Z" /><path d="m14.8 6.7 3 3" /></>,
  eraser: <><path d="m3.5 14.3 8.8-9.1a2 2 0 0 1 2.9 0l5.2 5.2a2 2 0 0 1 0 2.9l-6.4 6.4H8.7l-5.2-5.2a1.5 1.5 0 0 1 0-2.2Z" /><path d="m8.4 9.2 6.5 6.5M14 19.7h6.5" /></>,
  decorate: <path d="m12 3.5 2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7L12 3.5Z" />,
  undo: <><path d="m9 7-5 5 5 5" /><path d="M4.5 12h8a7 7 0 0 1 7 7" /></>,
  redo: <><path d="m15 7 5 5-5 5" /><path d="M19.5 12h-8a7 7 0 0 0-7 7" /></>,
  zoomOut: <path d="M5 12h14" />,
  zoomIn: <path d="M12 5v14M5 12h14" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  assistant: <><path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
  suggestions: <><path d="M4 7.5h6l2 3h8" /><path d="M17 7.5h3v3" /><path d="M4 16.5h5l2-3h9" /><path d="M17 16.5h3v-3" /><circle cx="4" cy="7.5" r="1" /><circle cx="4" cy="16.5" r="1" /></>,
  conclusion: <><path d="M5 3.5h7.5L16 7v13H5z" /><path d="M12.5 3.5V7H16M7.5 10.5h6M7.5 13.5h6M7.5 16.5h4" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

export type BoardIconName = keyof typeof paths;

export function BoardIcon({ name }: { name: BoardIconName }) {
  return <svg className="board-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
