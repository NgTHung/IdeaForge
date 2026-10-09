import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardBoardDescription,
  dashboardBoardMatches,
  dashboardBoardTitle,
  mostRecentlyEditedBoard,
  sortDashboardBoards,
} from "../src/features/board/dashboard-data.ts";

function board(id, values = {}) {
  return {
    id,
    title: `Board ${id}`,
    description: "",
    liveblocksRoomId: `room-${id}`,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    role: "owner",
    ...values,
  };
}

test("board title fallback never exposes an ID and preserves unusual user titles", () => {
  assert.equal(dashboardBoardTitle(board("secret-id", { title: "" })), "Untitled board");
  assert.equal(dashboardBoardTitle(board("secret-id", { title: "   " })), "Untitled board");
  assert.equal(dashboardBoardTitle(board("id", { title: " !!! ?? " })), " !!! ?? ");
});

test("board search matches title and description without changing case behavior", () => {
  const item = board("a", { title: "Community Garden", description: "Share unused yards" });
  assert.equal(dashboardBoardMatches(item, "garden"), true);
  assert.equal(dashboardBoardMatches(item, "UNUSED YARDS"), true);
  assert.equal(dashboardBoardMatches(item, "not here"), false);
  assert.equal(dashboardBoardMatches(item, ""), true);
  assert.equal(dashboardBoardDescription(board("b", { description: "  goal  " })), "goal");
});

test("board sorting uses the selected field and leaves the source list untouched", () => {
  const byName = [board("z", { title: "Zulu" }), board("a", { title: "Alpha" })];
  assert.deepEqual(sortDashboardBoards(byName, "name").map((item) => item.id), ["a", "z"]);
  assert.deepEqual(byName.map((item) => item.id), ["z", "a"]);

  const dated = [
    board("recent", { createdAt: "2026-10-02", updatedAt: "2026-10-04" }),
    board("old", { createdAt: "2026-10-01", updatedAt: "2026-10-03" }),
  ];
  assert.deepEqual(sortDashboardBoards(dated, "edited").map((item) => item.id), ["recent", "old"]);
  assert.deepEqual(sortDashboardBoards(dated, "created").map((item) => item.id), ["recent", "old"]);
});

test("featured board is selected by most recent metadata edit", () => {
  const older = board("older", { updatedAt: "2026-10-01T00:00:00.000Z" });
  const newest = board("newest", { updatedAt: "2026-10-08T00:00:00.000Z" });
  assert.equal(mostRecentlyEditedBoard([older, newest]), newest);
  assert.equal(mostRecentlyEditedBoard([]), null);
});
