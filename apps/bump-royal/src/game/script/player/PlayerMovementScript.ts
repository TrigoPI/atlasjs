import { Vec2 } from "@atlasjs/math";
import type { PlayerControlsType } from "../../controls";

import {
  AtlasScript,
  PlayerInput,
  RigidBody,
  Vector2Action,
  registerScriptMetadata,
  ScriptMetadata,
  ButtonAction,
} from "@atlasjs/gameplay";

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

  private readonly direction: Vec2 = new Vec2();
  private readonly facing: Vec2 = new Vec2(1, 0);
  private readonly target: Vec2 = new Vec2();

  private dashRequested: boolean = false;
  private dashRemaining: number = 0;
  private cooldownRemaining: number = 0;

  private rigidBody: RigidBody;
  private move: Vector2Action;
  private dash: ButtonAction;
  private fall: PlayerFallScript | undefined;

  public onCreate(): void {
    const controls: PlayerInput<PlayerControlsType> =
      this.requireComponent(PlayerInput);

    this.rigidBody = this.requireComponent(RigidBody);
    this.move = controls.get("move");
    this.dash = controls.get("dash");
    this.fall = this.getEntity(this.entityId).getScript(PlayerFallScript);
  }

  public onUpdate(): void {
    if (this.fall?.isFalling === true) {
      return;
    }

    const v: Vec2 = this.move.readValue();
    this.direction.copyFrom(v).normalize();

    if (this.direction.mag() > 0) {
      this.facing.copyFrom(this.direction);
    }

    if (this.dash.isPressed()) {
      this.dashRequested = true;
    }
  }

  public onFixedUpdate(dt: number): void {
    if (this.fall?.isFalling === true) {
      this.dashRequested = false;
      return;
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
    this.target.copyFrom(this.direction).mult(this.maxSpeed);

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
