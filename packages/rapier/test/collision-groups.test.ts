import { describe, expect, it } from "vitest";

import { packCollisionGroups } from "../src/mappers/collision-groups";

describe("packCollisionGroups", () => {
  it("packs membership into the high 16 bits and filter into the low 16", () => {
    expect(packCollisionGroups(0x0001, 0x0002)).toBe(0x00010002);
  });

  it("packs all-ones as an unsigned 32-bit value", () => {
    expect(packCollisionGroups(0xffff, 0xffff)).toBe(0xffffffff);
  });

  it("masks inputs to 16 bits", () => {
    expect(packCollisionGroups(0x1ffff, 0x1ffff)).toBe(0xffffffff);
  });
});
