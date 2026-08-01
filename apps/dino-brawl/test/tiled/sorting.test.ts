import { describe, expect, it } from "vitest";

import { groupNameSortingResolver } from "../../src/game/tiled/sorting";

describe("groupNameSortingResolver", () => {
  it("matches a group name to a known layer, case-insensitively", () => {
    const resolve = groupNameSortingResolver(["Ground", "Entities", "Overhead"], { fallback: "Default" });
    expect(resolve({ name: "ground_layer", groupPath: ["ground"] })).toBe("Ground");
    expect(resolve({ name: "props_layer", groupPath: ["ground"] })).toBe("Ground");
    expect(resolve({ name: "roof", groupPath: ["overhead"] })).toBe("Overhead");
  });

  it("walks the group path inner-to-outer and takes the first match", () => {
    const resolve = groupNameSortingResolver(["Ground", "Overhead"], { fallback: "Default" });
    expect(resolve({ name: "x", groupPath: ["overhead", "decor"] })).toBe("Overhead");
  });

  it("falls back when nothing matches", () => {
    const resolve = groupNameSortingResolver(["Ground"], { fallback: "Default" });
    expect(resolve({ name: "x", groupPath: ["nope"] })).toBe("Default");
    expect(resolve({ name: "x", groupPath: [] })).toBe("Default");
  });

  it("honours an explicit override by layer name", () => {
    const resolve = groupNameSortingResolver(["Ground", "Entities"], {
      override: { special: "Entities" },
      fallback: "Ground",
    });
    expect(resolve({ name: "special", groupPath: ["ground"] })).toBe("Entities");
  });
});
