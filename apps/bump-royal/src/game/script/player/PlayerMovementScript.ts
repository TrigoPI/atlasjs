import { Vec2 } from "@atlasjs/math";
import type { PlayerControls } from "@bump-royal/game/controls";

import {
  AtlasScript,
  PlayerInput,
  RigidBody,
  Vector2Action,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

type PlayerMovementScriptProps = {
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
};

export class PlayerMovementScript extends AtlasScript<PlayerMovementScriptProps> {
  private readonly maxSpeed: number;
  private readonly acceleration: number;
  private readonly deceleration: number;

  private rigidBody: RigidBody;
  private move: Vector2Action;

  private readonly direction: Vec2 = new Vec2();
  private readonly target: Vec2 = new Vec2();

  public onCreate(): void {
    const controls: PlayerInput<PlayerControls> =
      this.requireComponent(PlayerInput);

    this.rigidBody = this.requireComponent(RigidBody);
    this.move = controls.get("move");
  }

  public onUpdate(): void {
    this.direction.copyFrom(this.move.readValue()).normalize();
  }

  public onFixedUpdate(dt: number): void {
    const velocity: Vec2 = this.rigidBody.velocity;

    this.target.copyFrom(this.direction).mult(this.maxSpeed);

    const rate: number =
      this.target.mag() >= velocity.mag()
        ? this.acceleration
        : this.deceleration;

    velocity.moveTowards(this.target, rate * dt);
  }
}

registerScriptMetadata(PlayerMovementScript, {
  exposed: {
    maxSpeed: ScriptMetadata.field({ required: true }),
    acceleration: ScriptMetadata.field({ required: true }),
    deceleration: ScriptMetadata.field({ required: true }),
  },
});
