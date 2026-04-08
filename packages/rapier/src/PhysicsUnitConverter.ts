import { Vec2 } from "@atlasjs/math";

export class PhysicsUnitConverter {
  private readonly unitsPerMeter: number;

  public constructor(unitsPerMeter: number) {
    this.unitsPerMeter = unitsPerMeter;
  }

  public toPhysics(value: number): number {
    return value / this.unitsPerMeter;
  }

  public toWorld(value: number): number {
    return value * this.unitsPerMeter;
  }

  public vecToPhysics(vec2: Vec2): Vec2 {
    const x: number = this.toPhysics(vec2.x);
    const y: number = this.toPhysics(vec2.y);
    return new Vec2(x, y);
  }

  public vecToWorld(vec: Vec2): Vec2 {
    const x: number = this.toWorld(vec.x);
    const y: number = this.toWorld(vec.y);
    return new Vec2(x, y);
  }

  public vecToWorldInto(vec: Vec2): Vec2 {
    const x: number = this.toWorld(vec.x);
    const y: number = this.toWorld(vec.y);
    vec.set(x, y);
    return vec;
  }

  public vecToPhysicsInto(vec: Vec2): Vec2 {
    const x: number = this.toPhysics(vec.x);
    const y: number = this.toPhysics(vec.y);
    vec.set(x, y);
    return vec;
  }
}
