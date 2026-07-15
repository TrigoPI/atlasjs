import { Vec2 } from "@atlasjs/math";

import { Input } from "../Input";

import { Vector2ActionSpec, Vector2Composite } from "./bindings";
import { InputAction } from "./InputAction";

export class Vector2Action extends InputAction {
  private readonly composite: Vector2Composite;
  private readonly current: Vec2;
  private readonly previous: Vec2;

  public constructor(spec: Vector2ActionSpec) {
    super();
    this.composite = spec.composite;
    this.current = new Vec2(0, 0);
    this.previous = new Vec2(0, 0);
  }

  public sample(input: Input, _dt: number): void {
    this.previous.set(this.current.x, this.current.y);

    const x: number =
      (input.isDown(this.composite.right) ? 1 : 0) -
      (input.isDown(this.composite.left) ? 1 : 0);

    const y: number =
      (input.isDown(this.composite.up) ? 1 : 0) -
      (input.isDown(this.composite.down) ? 1 : 0);

    this.current.set(x, y);
  }

  public readValue(): Vec2 {
    return this.current;
  }

  public get x(): number {
    return this.current.x;
  }

  public get y(): number {
    return this.current.y;
  }
}
