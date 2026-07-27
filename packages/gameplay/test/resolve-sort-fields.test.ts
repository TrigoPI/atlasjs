import { describe, it, expect } from "vitest";

import { SortingLayers, resolveSortFields, SortFields } from "../src/rendering";

describe("resolveSortFields", () => {
  it("uses world Y as primary and sortingOrder as secondary in a ySorted layer", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Entities", mode: "ySorted" }]);
    const fields: SortFields = resolveSortFields(layers, "Entities", 3, 42);
    expect(fields.layer).toBe(layers.indexOf("Entities"));
    expect(fields.primary).toBe(42);
    expect(fields.secondary).toBe(3);
  });

  it("uses sortingOrder as primary and 0 as secondary in a manual layer", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Ground", mode: "manual" }]);
    const fields: SortFields = resolveSortFields(layers, "Ground", 7, 99);
    expect(fields.layer).toBe(layers.indexOf("Ground"));
    expect(fields.primary).toBe(7);
    expect(fields.secondary).toBe(0);
  });

  it("falls back to layer 0 (manual) for an unknown layer name", () => {
    const layers: SortingLayers = new SortingLayers();
    const fields: SortFields = resolveSortFields(layers, "Nope", 5, 88);
    expect(fields.layer).toBe(0);
    expect(fields.primary).toBe(5);
    expect(fields.secondary).toBe(0);
  });
});
