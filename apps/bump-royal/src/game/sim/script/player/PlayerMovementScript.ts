import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  RigidBody,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

import { MoveIntent } from "../../MoveIntent";
import { PlayerStatus } from "../../PlayerStatus";

export type PlayerMovementProps = {
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  overspeedDeceleration: number;
  dashSpeed: number;
  dashDuration: number;
  dashCooldown: number;
};

export class PlayerMovementScript extends AtlasScript<PlayerMovementProps> {
  private readonly maxSpeed: number;
  private readonly acceleration: number;
  private readonly deceleration: number;
  private readonly dashSpeed: number;
  private readonly dashDuration: number;
  private readonly dashCooldown: number;
  private readonly overspeedDeceleration: number;

  private readonly target: Vec2 = new Vec2();

  private dashRequested: boolean = false;

  private rigidBody: RigidBody;
  private intent: MoveIntent;
  private status: PlayerStatus;

  public onCreate(): void {
    this.intent = this.requireComponent(MoveIntent);
    this.rigidBody = this.requireComponent(RigidBody);
    this.status = this.requireComponent(PlayerStatus);
  }

  public onFixedUpdate(dt: number): void {
    /* MoveIntent.dash is a per-tick edge; dashRequested is a buffer. It is cleared only
       when the dash actually fires, so a press during the cooldown fires the instant the
       cooldown ends. Consuming the edge directly would silently delete that buffer. */
    if (this.intent.dash) {
      this.dashRequested = true;
    }

    if (this.status.falling) {
      this.dashRequested = false;
      return;
    }

    const direction: Vec2 = this.intent.direction;

    if (direction.mag() > 0) {
      this.status.facing.copyFrom(direction);
    }

    if (this.dashRequested && this.canDash()) {
      this.dashRequested = false;
      this.startDash();
      return;
    }

    this.status.cooldownRemaining = this.countDown(
      this.status.cooldownRemaining,
      dt,
    );

    if (this.status.dashRemaining > 0) {
      this.status.dashRemaining = this.countDown(this.status.dashRemaining, dt);
      return;
    }

    this.steer(dt);
  }

  private canDash(): boolean {
    return (
      !(this.status.dashRemaining > 0) && !(this.status.cooldownRemaining > 0)
    );
  }

  private startDash(): void {
    this.rigidBody.velocity.copyFrom(this.status.facing).mult(this.dashSpeed);
    this.status.dashRemaining = this.dashDuration;
    this.status.cooldownRemaining = this.dashCooldown;
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
