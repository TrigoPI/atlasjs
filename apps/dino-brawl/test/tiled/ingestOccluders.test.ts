import { describe, expect, it } from "vitest";

import { TiledDocument } from "../../src/game/tiled/TiledDocument";
import { isOccluderRegion } from "../../src/game/tiled/ingestOccluders";

const occluderFixture = {
  width: 2,
  height: 2,
  tilewidth: 32,
  tileheight: 32,
  tilesets: [
    {
      name: "props",
      firstgid: 1,
      columns: 16,
      tilecount: 256,
      tilewidth: 32,
      tileheight: 32,
      image: "../assets/tilesets/props/props.png",
    },
  ],
  layers: [
    {
      type: "objectgroup",
      name: "occluder_regions",
      objects: [{ id: 103, name: "", x: 416, y: 480, width: 32, height: 96 }],
    },
  ],
};

describe("occluder region detection (Tiled)", () => {
  it("detects a nameless rect placed on the 'occluder_regions' object layer", () => {
    const doc = new TiledDocument(occluderFixture);

    expect(doc.objects).toHaveLength(1);

    const obj = doc.objects[0];
    expect(obj.kind).toBe("rect");
    expect(obj.groupPath).toContain("occluder_regions");
    expect(isOccluderRegion(obj)).toBe(true);
  });
});
