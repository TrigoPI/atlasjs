import { Collider } from "@atlasjs/inertia";

import { Collider2D } from "./Collider2D";

export class PhysicsColliderRef {
  public collider: Collider;

  private isSensor: boolean;
  private layer: number;
  private collidesWith: number;
  private friction: number;
  private restitution: number;
  private density: number;

  public constructor(collider: Collider, source: Collider2D) {
    this.collider = collider;
    this.isSensor = source.isSensor;
    this.layer = source.layer;
    this.collidesWith = source.collidesWith;
    this.friction = source.friction;
    this.restitution = source.restitution;
    this.density = source.density;
  }

  public sync(source: Collider2D): void {
    if (source.isSensor !== this.isSensor) {
      this.isSensor = source.isSensor;
      this.collider.setSensor(source.isSensor);
    }

    if (source.layer !== this.layer) {
      this.layer = source.layer;
      this.collider.setCollisionGroup(source.layer);
    }

    if (source.collidesWith !== this.collidesWith) {
      this.collidesWith = source.collidesWith;
      this.collider.setCollisionMask(source.collidesWith);
    }

    if (source.friction !== this.friction) {
      this.friction = source.friction;
      this.collider.setFriction(source.friction);
    }

    if (source.restitution !== this.restitution) {
      this.restitution = source.restitution;
      this.collider.setRestitution(source.restitution);
    }

    if (source.density !== this.density) {
      this.density = source.density;
      this.collider.setDensity(source.density);
    }
  }
}
