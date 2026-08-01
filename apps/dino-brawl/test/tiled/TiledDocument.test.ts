import { describe, expect, it } from "vitest";

import { TiledDocument } from "../../src/game/tiled/TiledDocument";
import type { RectObject, PointObject, TileObject } from "../../src/game/tiled/resolved.types";

const fixture = {
  width: 2,
  height: 2,
  tilewidth: 32,
  tileheight: 32,
  tilesets: [
    { name: "grass", firstgid: 1, columns: 8, tilecount: 64, tilewidth: 32, tileheight: 32, image: "../assets/tilesets/ground/grass-tileset.png" },
    { name: "props", firstgid: 65, columns: 16, tilecount: 256, tilewidth: 32, tileheight: 32, image: "../assets/tilesets/props/props.png" },
    { name: "test", firstgid: 321, columns: 0, tilecount: 1, tilewidth: 160, tileheight: 160, image: null },
  ],
  layers: [
    {
      type: "group",
      name: "ground",
      layers: [
        { type: "tilelayer", name: "ground_layer", data: [1, 65, 0, 0x80000002] },
      ],
    },
    {
      type: "group",
      name: "systems",
      layers: [
        {
          type: "objectgroup",
          name: "systems_objects",
          objects: [
            { id: 1, name: "spawn_point", x: 48, y: 32, width: 0, height: 0, point: true },
            { id: 2, name: "tree", x: 64, y: 96, width: 32, height: 32, gid: 65 },
            { id: 3, name: "wall", x: 10, y: 20, width: 40, height: 8 },
          ],
        },
      ],
    },
  ],
};

describe("TiledDocument tilesets", () => {
  it("keeps only tilesets that have an image", () => {
    const doc = new TiledDocument(fixture);
    expect(doc.tilesets.map((t) => t.name)).toEqual(["grass", "props"]);
    expect(doc.tilesets[0]).toMatchObject({ firstGid: 1, columns: 8, rows: 8, tileCount: 64, spacing: 0, margin: 0 });
  });
});

describe("TiledDocument tile layers", () => {
  it("flattens groups and records the group path + stacking order", () => {
    const doc = new TiledDocument(fixture);
    expect(doc.tileLayers).toHaveLength(1);
    expect(doc.tileLayers[0]).toMatchObject({ name: "ground_layer", groupPath: ["ground"], order: 0 });
  });

  it("resolves gids to row-flipped Atlas indices across tilesets and drops empty cells", () => {
    const doc = new TiledDocument(fixture);
    const cells = doc.tileLayers[0].cells;
    expect(cells).toHaveLength(3);
    expect(cells[0]).toMatchObject({ cx: 0, cy: 0, localIndex: 56, flipX: false });
    expect(cells[0].tileset.name).toBe("grass");
    expect(cells[1]).toMatchObject({ cx: 1, cy: 0, localIndex: 240 });
    expect(cells[1].tileset.name).toBe("props");
    expect(cells[2]).toMatchObject({ cx: 1, cy: 1, localIndex: 57, flipX: true });
    expect(cells[2].tileset.name).toBe("grass");
  });
});

describe("TiledDocument objects", () => {
  it("types point / tile / rect objects and carries the group path", () => {
    const doc = new TiledDocument(fixture);
    const byName: Record<string, unknown> = Object.fromEntries(doc.objects.map((o) => [o.name, o]));

    const spawn = byName["spawn_point"] as PointObject;
    expect(spawn).toMatchObject({ kind: "point", x: 48, y: 32, groupPath: ["systems"] });

    const tree = byName["tree"] as TileObject;
    expect(tree).toMatchObject({ kind: "tile", localIndex: 240, width: 32, height: 32, x: 64, y: 96 });
    expect(tree.tileset.name).toBe("props");

    const wall = byName["wall"] as RectObject;
    expect(wall).toMatchObject({ kind: "rect", x: 10, y: 20, width: 40, height: 8 });
  });
});
