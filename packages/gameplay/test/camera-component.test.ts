import { describe, expect, it } from "vitest";
import { Camera } from "../src/components";

describe("Camera component", () => {
  it("defaults zoom to 1", () => {
    const camera: Camera = new Camera();
    expect(camera.zoom).toBe(1);
  });

  it("allows zoom to be set", () => {
    const camera: Camera = new Camera();
    camera.zoom = 2.5;
    expect(camera.zoom).toBe(2.5);
  });
});
