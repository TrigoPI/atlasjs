import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";

import { ColliderResolver, RigidBodyResolver } from "./rapier-types";

import {
  AABB,
  Collider,
  PhysicsQuery,
  RaycastHit,
  RigidBody,
} from "@atlasjs/inertia";

export class RapierPhysicsQuery implements PhysicsQuery {
  private readonly world: RAPIER.World;
  private readonly resolveCollider: ColliderResolver;
  private readonly resolveBody: RigidBodyResolver;
  public constructor(
    world: RAPIER.World,
    resolveCollider: ColliderResolver,
    resolveBody: RigidBodyResolver,
  ) {
    this.world = world;
    this.resolveCollider = resolveCollider;
    this.resolveBody = resolveBody;
  }

  public raycast(
    origin: Vec2,
    direction: Vec2,
    maxDistance: number,
  ): RaycastHit | null {
    const ray: RAPIER.Ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y },
      { x: direction.x, y: direction.y },
    );

    const hit: RAPIER.RayColliderIntersection | null =
      this.world.castRayAndGetNormal(ray, maxDistance, true);

    if (!hit) {
      return null;
    }

    const collider: Collider | null = this.resolveCollider(hit.collider.handle);

    if (!collider) {
      return null;
    }

    const bodyHandle: RAPIER.RigidBody | null = hit.collider.parent();

    const body: RigidBody | null =
      bodyHandle != null ? this.resolveBody(bodyHandle.handle) : null;

    return {
      collider,
      body,
      normal: new Vec2(hit.normal.x, hit.normal.y),
      toi: hit.timeOfImpact,
    };
  }

  public intersectPoint(_point: Vec2): Collider[] {
    return [];
  }

  public intersectAABB(_bounds: AABB): Collider[] {
    return [];
  }
}
