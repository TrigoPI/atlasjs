import { describe, it, expect, vi } from "vitest";
import { Logger } from "@atlasjs/utils";

import { SortingLayers } from "../src/rendering/SortingLayers";

function fakeLogger(): { logger: Logger; warn: ReturnType<typeof vi.fn> } {
  const warn: ReturnType<typeof vi.fn> = vi.fn();
  const logger: Logger = {
    warn,
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  return { logger, warn };
}

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

describe("SortingLayers — unknown layer warnings", () => {
  it("warns only once for repeated lookups of the same unknown name", () => {
    const { logger, warn } = fakeLogger();
    const layers: SortingLayers = new SortingLayers(logger);

    for (let i: number = 0; i < 64; i++) {
      expect(layers.indexOf("Nope")).toBe(0);
    }

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns once per distinct unknown name", () => {
    const { logger, warn } = fakeLogger();
    const layers: SortingLayers = new SortingLayers(logger);

    layers.indexOf("Nope");
    layers.indexOf("Nope");
    layers.indexOf("AlsoNope");
    layers.indexOf("AlsoNope");

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain("Nope");
    expect(warn.mock.calls[1][0]).toContain("AlsoNope");
  });

  it("mentions the offending name and that the warning is not repeated", () => {
    const { logger, warn } = fakeLogger();
    const layers: SortingLayers = new SortingLayers(logger);

    layers.indexOf("Ghost");

    const message: string = warn.mock.calls[0][0] as string;
    expect(message).toContain("Ghost");
    expect(message).toContain("Default");
    expect(message.toLowerCase()).toContain("once");
  });

  it("never warns for a known layer name", () => {
    const { logger, warn } = fakeLogger();
    const layers: SortingLayers = new SortingLayers(logger);
    layers.define([{ name: "Entities", mode: "ySorted" }]);
    warn.mockClear();

    expect(layers.indexOf("Default")).toBe(0);
    expect(layers.indexOf("Entities")).toBe(1);
    expect(layers.indexOf("Entities")).toBe(1);

    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps returning the Default index every time, warning or not", () => {
    const { logger } = fakeLogger();
    const layers: SortingLayers = new SortingLayers(logger);

    expect(layers.indexOf("Nope")).toBe(0);
    expect(layers.indexOf("Nope")).toBe(0);
    expect(layers.indexOf("Other")).toBe(0);
  });
});
