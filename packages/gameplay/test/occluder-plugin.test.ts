import { describe, expect, it } from "vitest";
import { Vec4 } from "@atlasjs/math";
import type { TileInstance, Texture2D } from "@atlasjs/nebula";
import { OccluderStrip, bakeOccluderStrips } from "@atlasjs/gameplay";
import { createHarness } from "./helpers/harness";
import type { Harness } from "./helpers/harness";

describe("GameplayPlugin — occluders", () => {
  it("exporte OccluderStrip et bakeOccluderStrips depuis le barrel", () => {
    expect(typeof OccluderStrip).toBe("function");
    expect(typeof bakeOccluderStrips).toBe("function");
  });

  it("définit le composant OccluderStrip (addComponent ne throw pas)", async () => {
    const h: Harness = await createHarness();
    const texture: Texture2D = {
      width: 64,
      height: 64,
    } as unknown as Texture2D;
    const tiles: TileInstance[] = [
      { x: 0, y: 0, width: 32, height: 32, uvRect: new Vec4(0, 0, 0.5, 0.5) },
    ];
    const e = h.world.createEntity();
    expect(() =>
      h.world.addComponent(e, OccluderStrip, 12, tiles, texture, "Entities"),
    ).not.toThrow();
  });
});
