import { describe, it, expect } from "vitest";

import { SortingLayers } from "../src/rendering/SortingLayers";

describe("SortingLayers", () => {
  it("seeds 'Default' at index 0 with manual mode", () => {
    const layers: SortingLayers = new SortingLayers();
    expect(layers.indexOf("Default")).toBe(0);
    expect(layers.modeOf(0)).toBe("manual");
  });

  it("assigns increasing indices after Default in declaration order", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([
      { name: "Ground", mode: "manual" },
      { name: "Entities", mode: "ySorted" },
      { name: "Overhead", mode: "manual" },
    ]);
    expect(layers.indexOf("Ground")).toBe(1);
    expect(layers.indexOf("Entities")).toBe(2);
    expect(layers.indexOf("Overhead")).toBe(3);
  });

  it("exposes each layer's sort mode by index", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Entities", mode: "ySorted" }]);
    expect(layers.modeOf(layers.indexOf("Entities"))).toBe("ySorted");
  });

  it("defaults a layer with no explicit mode to manual", () => {
    const layers: SortingLayers = new SortingLayers();
    layers.define([{ name: "Foreground" }]);
    expect(layers.modeOf(layers.indexOf("Foreground"))).toBe("manual");
  });

  it("falls back to index 0 for an unknown layer name", () => {
    const layers: SortingLayers = new SortingLayers();
    expect(layers.indexOf("Nope")).toBe(0);
  });

  it("returns manual for an out-of-range index", () => {
    const layers: SortingLayers = new SortingLayers();
    expect(layers.modeOf(99)).toBe("manual");
  });
});
