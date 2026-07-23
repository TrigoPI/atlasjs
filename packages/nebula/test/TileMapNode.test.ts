import { describe, expect, it } from "vitest";
import { TileMapNode } from "../src/graphics/TileMapNode";
import { KIND_ORDER } from "../src/renderers/NodeRenderer";

describe("TileMapNode", () => {
  it("defaults to alpha blend, white tint, no texture, empty instances", () => {
    const node: TileMapNode = new TileMapNode();
    expect(node.texture).toBeNull();
    expect(node.blend).toBe("alpha");
    expect(node.tint.x).toBe(1);
    expect(node.tint.w).toBe(1);
    expect(node.instances.length).toBe(0);
    expect(node.visible).toBe(true);
  });
});

describe("KIND_ORDER", () => {
  it("orders tilemap after sprite and shape", () => {
    expect(KIND_ORDER.tilemap).toBe(2);
    expect(KIND_ORDER.tilemap).toBeGreaterThan(KIND_ORDER.sprite);
    expect(KIND_ORDER.tilemap).toBeGreaterThan(KIND_ORDER.shape);
  });
});
