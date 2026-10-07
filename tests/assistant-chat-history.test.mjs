import assert from "node:assert/strict";
import { test } from "node:test";

const { assistantHistoryFor } = await import("../src/features/board/assistant-chat-history.ts");

test("assistant history includes only completed user requests and successful replies", () => {
  assert.deepEqual(assistantHistoryFor([
    { role: "user", text: "First question", completed: true },
    { role: "assistant", text: "First answer" },
    { role: "user", text: "Failed request", completed: false },
  ]), [
    { role: "user", text: "First question" },
    { role: "assistant", text: "First answer" },
  ]);
});

test("assistant history keeps only the latest ten nonblank completed turns", () => {
  const turns = Array.from({ length: 12 }, (_, index) => ({ role: "user", text: `Question ${index}`, completed: true }));
  assert.deepEqual(assistantHistoryFor(turns).map(({ text }) => text), Array.from({ length: 10 }, (_, index) => `Question ${index + 2}`));
});
