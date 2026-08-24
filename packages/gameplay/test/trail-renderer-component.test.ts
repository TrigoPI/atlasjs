import { describe, expect, it } from "vitest";
import { TrailRenderer } from "../src/components";

describe("TrailRenderer component", () => {
  it("defaults smoothing to 3", () => {
    const trailRenderer: TrailRenderer = new TrailRenderer();
    expect(trailRenderer.smoothing).toBe(3);
  });

  it("allows smoothing to be set", () => {
    const trailRenderer: TrailRenderer = new TrailRenderer({ smoothing: 5 });
    expect(trailRenderer.smoothing).toBe(5);
  });
});
