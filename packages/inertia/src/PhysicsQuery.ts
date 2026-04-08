import { Vec2 } from "@atlasjs/math";
import { AABB, RaycastHit } from "./inertial-type";
import { Collider } from "./Collider";

export interface PhysicsQuery {
  intersectPoint(point: Vec2): Collider[];
  intersectAABB(bounds: AABB): Collider[];
  raycast(
    origin: Vec2,
    direction: Vec2,
    maxDistance: number,
  ): RaycastHit | null;
}
