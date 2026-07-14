import { describe, it, expect } from "vitest";

import { Color } from "../src/utils";

describe("Color.set", () => {
  it("defaults alpha to 1 when omitted", () => {
    const color: Color = new Color(0, 0, 0, 0);
    color.set(0.2, 0.4, 0.6);

    expect(color.r).toBeCloseTo(0.2);
    expect(color.a).toBe(1);
  });
});
