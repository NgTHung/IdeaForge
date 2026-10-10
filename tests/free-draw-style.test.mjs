import assert from "node:assert/strict";
import test from "node:test";
import { defaultFreeDrawWidth, freeDrawColor, freeDrawWidth } from "../src/features/board/free-draw-style.ts";

test("freehand styles keep valid saved values and use safe defaults for older or invalid strokes", () => {
  assert.equal(freeDrawColor("#a1B2c3", "#176c52"), "#a1B2c3");
  assert.equal(freeDrawColor(undefined, "#176c52"), "#176c52");
  assert.equal(freeDrawColor("url(https://example.invalid)", "#176c52"), "#176c52");
  assert.equal(freeDrawWidth(7.5), 7.5);
  assert.equal(freeDrawWidth(-2), 1);
  assert.equal(freeDrawWidth(50), 12);
  assert.equal(freeDrawWidth(Number.NaN), defaultFreeDrawWidth);
  assert.equal(freeDrawWidth(undefined), defaultFreeDrawWidth);
});
