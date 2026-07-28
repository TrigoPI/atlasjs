import { Vec2 } from "@atlasjs/math";
import { ALL_LAYERS, ColliderShapeDesc } from "@atlasjs/inertia";

export class Collider2D {
  public shape: ColliderShapeDesc;
  public offset: Vec2;
  public rotation: number;
  public isSensor: boolean;
  public layer: number;
  public collidesWith: number;
  public friction: number;
  public restitution: number;
  public density: number;

  public constructor(shape: ColliderShapeDesc) {
    this.shape = shape;
    this.offset = new Vec2(0, 0);
    this.rotation = 0;
    this.isSensor = false;
    this.layer = ALL_LAYERS;
    this.collidesWith = ALL_LAYERS;
    this.friction = 0.5;
    this.restitution = 0;
    this.density = 0;
  }
}
