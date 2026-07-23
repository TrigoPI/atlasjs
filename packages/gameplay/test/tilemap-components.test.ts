import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { Color } from "@atlasjs/nebula";
import { Grid } from "../src/components/Grid";
import { TileMapRenderer } from "../src/components/TileMapRenderer";

describe("Grid component", () => {
  it("stores cellSize and defaults cellGap to (0,0)", () => {
    const grid: Grid = new Grid(new Vec2(128, 128));
    expect(grid.cellSize.x).toBe(128);
    expect(grid.cellSize.y).toBe(128);
    expect(grid.cellGap.x).toBe(0);
    expect(grid.cellGap.y).toBe(0);
  });

  it("accepts an explicit cellGap", () => {
    const grid: Grid = new Grid(new Vec2(16, 16), new Vec2(2, 4));
    expect(grid.cellGap.x).toBe(2);
    expect(grid.cellGap.y).toBe(4);
  });
});

describe("TileMapRenderer component", () => {
  it("defaults to sortingOrder 0, white, visible", () => {
    const renderer: TileMapRenderer = new TileMapRenderer();
    expect(renderer.sortingOrder).toBe(0);
    expect(renderer.visible).toBe(true);
    expect(renderer.color.r).toBe(1);
    expect(renderer.color.a).toBe(1);
  });

  it("accepts explicit values", () => {
    const renderer: TileMapRenderer = new TileMapRenderer(10, Color.Red(), false);
    expect(renderer.sortingOrder).toBe(10);
    expect(renderer.visible).toBe(false);
    expect(renderer.color.r).toBe(1);
    expect(renderer.color.g).toBe(0);
  });
});
