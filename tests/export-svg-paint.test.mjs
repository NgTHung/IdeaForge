import assert from "node:assert/strict";
import test from "node:test";
import { inlineSvgPaintForExport } from "../src/features/board/export-svg-paint.ts";

function style(initial = {}) {
  const values = new Map(Object.entries(initial));
  const priorities = new Map();
  return {
    getPropertyValue: (property) => values.get(property) ?? "",
    getPropertyPriority: (property) => priorities.get(property) ?? "",
    setProperty: (property, value, priority = "") => { values.set(property, value); priorities.set(property, priority); },
    removeProperty: (property) => { values.delete(property); priorities.delete(property); },
  };
}

test("SVG border paint is inlined for export and restored afterward", () => {
  const flowerPetal = { style: style({ fill: "#original" }) };
  const computedPaint = new Map([
    ["fill", "rgb(230, 140, 180)"],
    ["stroke", "rgb(255, 255, 255)"],
    ["stroke-width", "1.5px"],
  ]);
  const originalGetComputedStyle = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ getPropertyValue: (property) => computedPaint.get(property) ?? "" });

  try {
    const restore = inlineSvgPaintForExport({ querySelectorAll: () => [flowerPetal] });
    assert.equal(flowerPetal.style.getPropertyValue("fill"), "rgb(230, 140, 180)");
    assert.equal(flowerPetal.style.getPropertyPriority("fill"), "important");
    assert.equal(flowerPetal.style.getPropertyValue("stroke"), "rgb(255, 255, 255)");
    assert.equal(flowerPetal.style.getPropertyValue("stroke-width"), "1.5px");

    restore();
    assert.equal(flowerPetal.style.getPropertyValue("fill"), "#original");
    assert.equal(flowerPetal.style.getPropertyPriority("fill"), "");
    assert.equal(flowerPetal.style.getPropertyValue("stroke"), "");
  } finally {
    if (originalGetComputedStyle) globalThis.getComputedStyle = originalGetComputedStyle;
    else delete globalThis.getComputedStyle;
  }
});
