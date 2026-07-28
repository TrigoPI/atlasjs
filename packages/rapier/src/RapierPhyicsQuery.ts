import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";

import { ColliderResolver, RigidBodyResolver } from "./rapier-types";
import { PhysicsUnitConverter } from "./PhysicsUnitConverter";

import {
  AABB,
  Collider,
  PhysicsQuery,
  RaycastHit,
  RigidBody,
} from "@atlasjs/inertia";

export class RapierPhysicsQuery implements PhysicsQuery {
  private readonly world: RAPIER.World;
  private readonly converter: PhysicsUnitConverter;
  private readonly resolveCollider: ColliderResolver;
  private readonly resolveBody: RigidBodyResolver;

  public constructor(
    world: RAPIER.World,
    converter: PhysicsUnitConverter,
    resolveCollider: ColliderResolver,
    resolveBody: RigidBodyResolver,
  ) {
    this.world = world;
    this.converter = converter;
    this.resolveCollider = resolveCollider;
    this.resolveBody = resolveBody;
  }

  public raycast(
    origin: Vec2,
    direction: Vec2,
    maxDistance: number,
  ): RaycastHit | null {
    const ray: RAPIER.Ray = new RAPIER.Ray(
      {
        x: this.converter.toPhysics(origin.x),
        y: this.converter.toPhysics(origin.y),
      },
      { x: direction.x, y: direction.y },
    );

    const maxToi: number = this.converter.toPhysics(maxDistance);

    const hit: RAPIER.RayColliderIntersection | null =
      this.world.castRayAndGetNormal(ray, maxToi, true);

    if (!hit) {
      return null;
    }

    const collider: Collider | null = this.resolveCollider(hit.collider.handle);

    if (!collider) {
      return null;
    }

    const parent: RAPIER.RigidBody | null = hit.collider.parent();

    const body: RigidBody | null =
      parent != null ? this.resolveBody(parent.handle) : null;

    return {
      collider,
      body,
      normal: new Vec2(hit.normal.x, hit.normal.y),
      toi: this.converter.toWorld(hit.timeOfImpact),
    };
  }

  public intersectPoint(point: Vec2): Collider[] {
    const result: Collider[] = [];

    const target: RAPIER.Vector = {
      x: this.converter.toPhysics(point.x),
      y: this.converter.toPhysics(point.y),
    };

    this.world.intersectionsWithPoint(target, (found: RAPIER.Collider) => {
      const collider: Collider | null = this.resolveCollider(found.handle);
      if (collider) {
        result.push(collider);
      }
      return true;
    });

    return result;
  }

  public intersectAABB(bounds: AABB): Collider[] {
    const result: Collider[] = [];

    const minX: number = this.converter.toPhysics(bounds.min.x);
    const minY: number = this.converter.toPhysics(bounds.min.y);
    const maxX: number = this.converter.toPhysics(bounds.max.x);
    const maxY: number = this.converter.toPhysics(bounds.max.y);

    const shape: RAPIER.Cuboid = new RAPIER.Cuboid(
      (maxX - minX) / 2,
      (maxY - minY) / 2,
    );

    const center: RAPIER.Vector = {
      x: (maxX + minX) / 2,
      y: (maxY + minY) / 2,
    };

    this.world.intersectionsWithShape(
      center,
      0,
      shape,
      (found: RAPIER.Collider) => {
        const collider: Collider | null = this.resolveCollider(found.handle);
        if (collider) {
          result.push(collider);
        }
        return true;
      },
    );

    return result;
  }
}
