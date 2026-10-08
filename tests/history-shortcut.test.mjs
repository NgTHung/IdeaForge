import test from "node:test";
import assert from "node:assert/strict";
import { historyShortcut } from "../src/features/board/history-shortcut.ts";

const shortcut = (overrides = {}) => historyShortcut({
  key: "z", ctrlKey: false, metaKey: false, shiftKey: false,
  isComposing: false, keyCode: 90, targetIsEditable: false, ...overrides,
});

test("history shortcuts support Ctrl/Cmd undo and redo", () => {
  assert.equal(shortcut({ ctrlKey: true }), "undo");
  assert.equal(shortcut({ metaKey: true }), "undo");
  assert.equal(shortcut({ ctrlKey: true, shiftKey: true }), "redo");
  assert.equal(shortcut({ metaKey: true, shiftKey: true }), "redo");
  assert.equal(shortcut({ key: "y", ctrlKey: true, keyCode: 89 }), "redo");
  assert.equal(shortcut({ key: "y", metaKey: true, keyCode: 89 }), null);
});

test("editable controls and IME composition retain native typing shortcuts", () => {
  assert.equal(shortcut({ ctrlKey: true, targetIsEditable: true }), null);
  assert.equal(shortcut({ metaKey: true, targetIsEditable: true }), null);
  assert.equal(shortcut({ ctrlKey: true, isComposing: true }), null);
  assert.equal(shortcut({ ctrlKey: true, keyCode: 229 }), null);
  assert.equal(shortcut({ ctrlKey: true, key: "x", keyCode: 88 }), null);
});
