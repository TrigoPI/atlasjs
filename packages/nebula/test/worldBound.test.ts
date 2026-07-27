import { describe, it, expect } from "vitest";
import { Mat4, Bound } from "@atlasjs/math";

import { computeModelWorldBound } from "../src/renderers/utils/worldBound";

describe("computeModelWorldBound", () => {
  it("maps the identity model to the unit quad AABB", () => {
    const out: Bound = new Bound();
    computeModelWorldBound(Mat4.identity(), out);
    expect(out.x).toBeCloseTo(-0.5);
    expect(out.y).toBeCloseTo(-0.5);
    expect(out.width).toBeCloseTo(1);
    expect(out.height).toBeCloseTo(1);
  });

  it("applies scale and translation", () => {
    const out: Bound = new Bound();
    const model: Mat4 = Mat4.identity().translate(10, 20, 0).scale(4, 2);
    computeModelWorldBound(model, out);
    expect(out.x).toBeCloseTo(8);
    expect(out.y).toBeCloseTo(19);
    expect(out.width).toBeCloseTo(4);
    expect(out.height).toBeCloseTo(2);
  });
});
