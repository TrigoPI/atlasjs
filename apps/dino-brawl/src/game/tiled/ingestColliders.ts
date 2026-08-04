import type { Logger } from "@atlasjs/utils";
import type { CollisionLayer } from "@atlasjs/inertia";
import type { Entity, NexusWorld } from "@atlasjs/nexus";
import { Collider2D, Transform2D } from "@atlasjs/gameplay";

import type { MapCollider } from "./mapMath";
import type { TiledDocument } from "./TiledDocument";
import type { RectObject, ResolvedObject } from "./resolved.types";
import { colliderFromRect } from "./mapMath";

export function isColliderObject(obj: ResolvedObject): obj is RectObject {
  return (
    obj.kind === "rect" &&
    (obj.groupPath.includes("colliders") || obj.properties.collider === true)
  );
}

export function ingestColliders(
  nexus: NexusWorld,
  doc: TiledDocument,
  scale: number,
  layer: CollisionLayer,
  logger: Logger,
): number {
  let count: number = 0;

  for (const obj of doc.objects) {
    if (!isColliderObject(obj)) {
      continue;
    }

    const world: MapCollider = colliderFromRect(obj, scale);
    const entity: Entity = nexus.createEntity();

    const transform: Transform2D = nexus.addComponent(entity, Transform2D);
    transform.position.set(
      world.x + world.width / 2,
      world.y + world.height / 2,
    );

    const collider: Collider2D = nexus.addComponent(entity, Collider2D, {
      type: "box",
      width: world.width,
      height: world.height,
    });
    collider.layer = layer;

    count++;
  }

  if (count > 0) {
    logger.log(
      `Ingested ${count} world collider(s) from the 'colliders' layer.`,
    );
  }

  return count;
}
