import { describe, expect, it } from "vitest";
import { Color } from "@atlasjs/nebula";
import { AfterimageRenderer } from "../src/components";

describe("AfterimageRenderer component", () => {
  it("defaults every field to the documented value", () => {
    const renderer: AfterimageRenderer = new AfterimageRenderer();

    expect(renderer.interval).toBe(0.05);
    expect(renderer.minDistance).toBe(0);
    expect(renderer.time).toBe(0.25);
    expect(renderer.startColor.r).toBe(1);
    expect(renderer.startColor.g).toBe(1);
    expect(renderer.startColor.b).toBe(1);
    expect(renderer.startColor.a).toBe(0.5);
    expect(renderer.endColor.r).toBe(1);
    expect(renderer.endColor.g).toBe(1);
    expect(renderer.endColor.b).toBe(1);
    expect(renderer.endColor.a).toBe(0);
    expect(renderer.emitting).toBe(true);
    expect(renderer.maxImages).toBe(16);
    expect(renderer.visible).toBe(true);
    expect(renderer.sortingLayer).toBe("Default");
    expect(renderer.sortingOrder).toBe(0);
    expect(renderer.command).toBe("none");
  });

  it("takes every field from the options", () => {
    const startColor: Color = new Color(0.2, 0.3, 0.4, 0.9);
    const endColor: Color = new Color(0.5, 0.6, 0.7, 0.1);

    const renderer: AfterimageRenderer = new AfterimageRenderer({
      interval: 0.02,
      minDistance: 6,
      time: 0.4,
      startColor,
      endColor,
      emitting: false,
      maxImages: 5,
      visible: false,
      sortingLayer: "Entities",
      sortingOrder: 3,
    });

    expect(renderer.interval).toBe(0.02);
    expect(renderer.minDistance).toBe(6);
    expect(renderer.time).toBe(0.4);
    expect(renderer.startColor).toBe(startColor);
    expect(renderer.endColor).toBe(endColor);
    expect(renderer.emitting).toBe(false);
    expect(renderer.maxImages).toBe(5);
    expect(renderer.visible).toBe(false);
    expect(renderer.sortingLayer).toBe("Entities");
    expect(renderer.sortingOrder).toBe(3);
    expect(renderer.command).toBe("none");
  });

  it("clear() raises the clear command and returns this", () => {
    const renderer: AfterimageRenderer = new AfterimageRenderer();

    expect(renderer.clear()).toBe(renderer);
    expect(renderer.command).toBe("clear");
  });
});
