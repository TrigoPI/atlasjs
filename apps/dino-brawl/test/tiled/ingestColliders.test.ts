import { describe, expect, it } from "vitest";
import { createLogger } from "@atlasjs/utils";
import { NexusWorld, ComponentRegistry } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { Collider2D, Transform2D } from "@atlasjs/gameplay";

import { TiledDocument } from "../../src/game/tiled/TiledDocument";
import {
  ingestColliders,
  isColliderObject,
} from "../../src/game/tiled/ingestColliders";
import { CollisionLayers } from "../../src/game/config";

const fixture = {
  width: 2,
  height: 2,
  tilewidth: 32,
  tileheight: 32,
  tilesets: [],
  layers: [
    {
      type: "objectgroup",
      name: "colliders",
      objects: [{ id: 1, name: "", x: 100, y: 200, width: 32, height: 64 }],
    },
    {
      type: "objectgroup",
      name: "occluder_regions",
      objects: [{ id: 2, name: "", x: 0, y: 0, width: 32, height: 32 }],
    },
    {
      type: "objectgroup",
      name: "spawn_point",
      objects: [{ id: 3, name: "spawn", x: 10, y: 10, point: true }],
    },
  ],
};

describe("collider ingestion (Tiled)", () => {
  it("detects rects on the 'colliders' layer and rejects the others", () => {
    const doc = new TiledDocument(fixture);
    const hits = doc.objects.filter(isColliderObject);
    expect(hits).toHaveLength(1);
    expect(hits[0].width).toBe(32);

    const occluder = doc.objects.find((o) =>
      o.groupPath.includes("occluder_regions"),
    );
    expect(isColliderObject(occluder!)).toBe(false);
  });

  it("spawns one scaled, centered static box collider per collider rect", () => {
    const doc = new TiledDocument(fixture);
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());
    world.defineComponent(Transform2D).defineComponent(Collider2D);

    const count: number = ingestColliders(
      world,
      doc,
      2,
      CollisionLayers.World,
      createLogger("test"),
    );
    expect(count).toBe(1);

    const entities: Entity[] = world
      .query(Transform2D, Collider2D)
      .getEntities();
    expect(entities).toHaveLength(1);

    const t: Transform2D = world.requireComponent(entities[0], Transform2D);
    expect(t.position.x).toBe(232);
    expect(t.position.y).toBe(464);

    const c: Collider2D = world.requireComponent(entities[0], Collider2D);
    expect(c.shape).toEqual({ type: "box", width: 64, height: 128 });
    expect(c.layer).toBe(CollisionLayers.World);
  });
});
