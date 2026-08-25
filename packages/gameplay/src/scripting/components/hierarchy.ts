import { Mat3 } from "@atlasjs/math";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D, WorldTransform2D } from "../../components";

export function isDynamicBody(world: NexusWorld, entity: Entity): boolean {
  const rigidBody: RigidBody2D | undefined = world.getComponent(
    entity,
    RigidBody2D,
  );

  return rigidBody !== undefined && rigidBody.type === "dynamic";
}

export function worldMatrix(world: NexusWorld, entity: Entity): Mat3 {
  const wt: WorldTransform2D | undefined = world.getComponent(
    entity,
    WorldTransform2D,
  );

  if (wt !== undefined) {
    return wt.matrix.clone();
  }

  const local: Mat3 = Mat3.fromTransform2D(
    world.requireComponent(entity, Transform2D),
  );
  const parent: Entity | undefined = world.getParent(entity);

  if (parent === undefined || isDynamicBody(world, entity)) {
    return local;
  }

  return ancestorWorldMatrix(world, parent).multiply(local);
}

export function ancestorWorldMatrix(world: NexusWorld, entity: Entity): Mat3 {
  if (
    world.hasComponent(entity, WorldTransform2D) ||
    world.hasComponent(entity, Transform2D)
  ) {
    return worldMatrix(world, entity);
  }

  const parent: Entity | undefined = world.getParent(entity);

  return parent !== undefined
    ? ancestorWorldMatrix(world, parent)
    : Mat3.identity();
}
