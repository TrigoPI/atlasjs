import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";

import { PhysicsUnitConverter } from "../PhysicsUnitConverter";
import { packCollisionGroups } from "./collision-groups";

import {
  BoxColliderShapeDesc,
  CapsuleColliderShapeDesc,
  CircleColliderShapeDesc,
  ColliderDesc,
  ColliderShapeDesc,
  PolygonColliderShapeDesc,
  SegmentColliderShapeDesc,
} from "@atlasjs/inertia";

function vec2ToBuffer(datas: Vec2[]): Float32Array {
  const buffer: Float32Array = new Float32Array(datas.length * 2);
  for (let i = 0; i < datas.length; i++) {
    buffer[i * 2] = datas[i].x;
    buffer[i * 2 + 1] = datas[i].y;
  }

  return buffer;
}

function cuboid(shape: BoxColliderShapeDesc): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.cuboid(shape.width / 2, shape.height / 2);
}

function ball(shape: CircleColliderShapeDesc): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.ball(shape.radius);
}

function capsule(shape: CapsuleColliderShapeDesc): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius);
}

function segment(shape: SegmentColliderShapeDesc): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.segment(
    { x: shape.x1, y: shape.y1 },
    { x: shape.x2, y: shape.y2 },
  );
}

function polygon(shape: PolygonColliderShapeDesc): RAPIER.ColliderDesc | null {
  const points: Float32Array = vec2ToBuffer(shape.points);
  return RAPIER.ColliderDesc.convexHull(points);
}

function scaleDesc(
  desc: ColliderDesc,
  converter: PhysicsUnitConverter,
): ColliderDesc {
  const shapeCpy: ColliderShapeDesc = { ...desc.shape };
  const descCpy: ColliderDesc = { ...desc, shape: shapeCpy };

  if (descCpy.translation) {
    descCpy.translation = converter.vecToPhysics(descCpy.translation);
  }

  if (descCpy.shape.type === "box") {
    descCpy.shape.width = converter.toPhysics(descCpy.shape.width);
    descCpy.shape.height = converter.toPhysics(descCpy.shape.height);
  }

  if (descCpy.shape.type === "circle") {
    descCpy.shape.radius = converter.toPhysics(descCpy.shape.radius);
  }

  if (descCpy.shape.type === "capsule") {
    descCpy.shape.halfHeight = converter.toPhysics(descCpy.shape.halfHeight);
    descCpy.shape.radius = converter.toPhysics(descCpy.shape.radius);
  }

  if (descCpy.shape.type === "segment") {
    descCpy.shape.x1 = converter.toPhysics(descCpy.shape.x1);
    descCpy.shape.y1 = converter.toPhysics(descCpy.shape.y1);
    descCpy.shape.x2 = converter.toPhysics(descCpy.shape.x2);
    descCpy.shape.y2 = converter.toPhysics(descCpy.shape.y2);
  }

  if (descCpy.shape.type === "polygon") {
    descCpy.shape.points = descCpy.shape.points.map((point: Vec2) =>
      converter.vecToPhysics(point),
    );
  }

  return descCpy;
}

export function mapColliderDesc(
  desc: ColliderDesc,
  converter: PhysicsUnitConverter,
): RAPIER.ColliderDesc {
  const descCpy: ColliderDesc = scaleDesc(desc, converter);
  let collider: RAPIER.ColliderDesc | null;

  switch (descCpy.shape.type) {
    case "box":
      collider = cuboid(descCpy.shape);
      break;
    case "circle":
      collider = ball(descCpy.shape);
      break;
    case "capsule":
      collider = capsule(descCpy.shape);
      break;
    case "segment":
      collider = segment(descCpy.shape);
      break;
    case "polygon":
      collider = polygon(descCpy.shape);
      break;
    default: {
      const exhaustive: never = descCpy.shape;
      throw new Error(
        `Unsupported collider shape: ${JSON.stringify(exhaustive)}`,
      );
    }
  }

  if (!collider) {
    throw new Error(
      `Failed to create collider for shape: ${JSON.stringify(desc.shape)}`,
    );
  }

  if (descCpy.translation) {
    collider.setTranslation(descCpy.translation.x, descCpy.translation.y);
  }

  if (descCpy.rotation !== undefined) {
    collider.setRotation(descCpy.rotation);
  }

  if (descCpy.sensor !== undefined) {
    collider.setSensor(descCpy.sensor);
  }

  if (descCpy.friction !== undefined) {
    collider.setFriction(descCpy.friction);
  }

  if (descCpy.restitution !== undefined) {
    collider.setRestitution(descCpy.restitution);
  }

  if (descCpy.density !== undefined) {
    collider.setDensity(descCpy.density);
  }

  if (descCpy.enabled !== undefined) {
    collider.setEnabled(descCpy.enabled);
  }

  if (
    descCpy.collisionGroup !== undefined ||
    descCpy.collisionMask !== undefined
  ) {
    const membership: number = descCpy.collisionGroup ?? 0xffff;
    const filter: number = descCpy.collisionMask ?? 0xffff;
    collider.setCollisionGroups(packCollisionGroups(membership, filter));
  }

  if (descCpy.events === true) {
    collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
  }

  return collider;
}
