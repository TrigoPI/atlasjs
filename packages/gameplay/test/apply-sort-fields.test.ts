import { describe, it, expect } from "vitest";

import { SortingLayers } from "../src/rendering";
import { applySortFields } from "../src/rendering/applySortFields";
import type { SortTarget } from "../src/rendering/applySortFields";

function target(): SortTarget {
  return { sortingLayer: -1, sortPrimary: -1, sortSecondary: -1 };
}

describe("applySortFields", () => {
  it("writes world Y as primary and sortingOrder as secondary in a ySorted layer", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Entities", mode: "ySorted" }]);
    const t: SortTarget = target();
    applySortFields(t, layers, "Entities", 3, 42);
    expect(t.sortingLayer).toBe(layers.indexOf("Entities"));
    expect(t.sortPrimary).toBe(42);
    expect(t.sortSecondary).toBe(3);
  });

  it("writes sortingOrder as primary and 0 as secondary in a manual layer", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Ground", mode: "manual" }]);
    const t: SortTarget = target();
    applySortFields(t, layers, "Ground", 7, 99);
    expect(t.sortingLayer).toBe(layers.indexOf("Ground"));
    expect(t.sortPrimary).toBe(7);
    expect(t.sortSecondary).toBe(0);
  });

  it("falls back to layer 0 (manual) for an unknown layer name", () => {
    const layers: SortingLayers = new SortingLayers();
    const t: SortTarget = target();
    applySortFields(t, layers, "Nope", 5, 88);
    expect(t.sortingLayer).toBe(0);
    expect(t.sortPrimary).toBe(5);
    expect(t.sortSecondary).toBe(0);
  });
});
