import { describe, expect, it } from "vitest";
import { Vec4 } from "@atlasjs/math";
import type { TileInstance, Texture2D } from "@atlasjs/nebula";
import { OccluderStrip } from "../src/components/OccluderStrip";

describe("OccluderStrip", () => {
  it("stocke footY, tiles, texture et sortingLayer", () => {
    const texture: Texture2D = { width: 128, height: 128 } as unknown as Texture2D;
    const tiles: TileInstance[] = [
      { x: 0, y: 0, width: 32, height: 32, uvRect: new Vec4(0, 0, 0.25, 0.25) },
    ];
    const strip: OccluderStrip = new OccluderStrip(160, tiles, texture, "Entities");
    expect(strip.footY).toBe(160);
    expect(strip.tiles).toBe(tiles);
    expect(strip.texture).toBe(texture);
    expect(strip.sortingLayer).toBe("Entities");
  });
});
