import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  RigidBody,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

import { MoveIntent } from "../../sim";
import { PlayerFallScript } from "./PlayerFallScript";

type PlayerMovementScriptProps = {
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  overspeedDeceleration: number;
  dashSpeed: number;
  dashDuration: number;
  dashCooldown: number;
};

export class PlayerMovementScript extends AtlasScript<PlayerMovementScriptProps> {
  private readonly maxSpeed: number;
  private readonly acceleration: number;
  private readonly deceleration: number;
  private readonly dashSpeed: number;
  private readonly dashDuration: number;
  private readonly dashCooldown: number;
  private readonly overspeedDeceleration: number;

  private readonly facing: Vec2 = new Vec2(1, 0);
  private readonly target: Vec2 = new Vec2();

  private dashRequested: boolean = false;
  private dashRemaining: number = 0;
  private cooldownRemaining: number = 0;

  private rigidBody: RigidBody;
  private intent: MoveIntent;
  private fall: PlayerFallScript | undefined;

  public onCreate(): void {
    this.intent = this.requireComponent(MoveIntent);
    this.rigidBody = this.requireComponent(RigidBody);
    this.fall = this.getEntity(this.entityId).getScript(PlayerFallScript);
  }

  public onFixedUpdate(dt: number): void {
    /* MoveIntent.dash is a per-tick edge; dashRequested is a buffer. It is cleared only
       when the dash actually fires, so a press during the cooldown fires the instant the
       cooldown ends. Consuming the edge directly would silently delete that buffer. */
    if (this.intent.dash) {
      this.dashRequested = true;
    }

    if (this.fall?.isFalling === true) {
      this.dashRequested = false;
      return;
    }

    const direction: Vec2 = this.intent.direction;

    if (direction.mag() > 0) {
      this.facing.copyFrom(direction);
    }

    if (this.dashRequested && this.canDash()) {
      this.dashRequested = false;
      this.startDash();
      return;
    }

    this.cooldownRemaining = this.countDown(this.cooldownRemaining, dt);

    if (this.dashRemaining > 0) {
      this.dashRemaining = this.countDown(this.dashRemaining, dt);
      return;
    }

    this.steer(dt);
  }

  private canDash(): boolean {
    return !(this.dashRemaining > 0) && !(this.cooldownRemaining > 0);
  }

  private startDash(): void {
    this.rigidBody.velocity.copyFrom(this.facing).mult(this.dashSpeed);
    this.dashRemaining = this.dashDuration;
    this.cooldownRemaining = this.dashCooldown;
  }

  private countDown(remaining: number, dt: number): number {
    const next: number = remaining - dt;
    return next > 0 ? next : 0;
  }

  private steer(dt: number): void {
    const velocity: Vec2 = this.rigidBody.velocity;
    this.target.copyFrom(this.intent.direction).mult(this.maxSpeed);

    const rate: number = this.getRate();
    velocity.moveTowards(this.target, rate * dt);
  }

  private getRate(): number {
    const speed: number = this.rigidBody.velocity.mag();

    if (speed > this.maxSpeed) return this.overspeedDeceleration;

    return this.target.mag() >= speed ? this.acceleration : this.deceleration;
  }
}

registerScriptMetadata(PlayerMovementScript, {
  exposed: {
    maxSpeed: ScriptMetadata.field({ required: true }),
    acceleration: ScriptMetadata.field({ required: true }),
    deceleration: ScriptMetadata.field({ required: true }),
    dashSpeed: ScriptMetadata.field({ required: true }),
    dashDuration: ScriptMetadata.field({ required: true }),
    dashCooldown: ScriptMetadata.field({ required: true }),
    overspeedDeceleration: ScriptMetadata.field({ required: true }),
  },
});
