import {
  CharacterControllerOptions,
  CharacterControllerState,
} from "./inertial-type";
import { RigidBody } from "./RigidBody";

export class CharacterController {
  private readonly body: RigidBody;
  private readonly maxSpeed: number;
  private readonly acceleration: number;
  private readonly deceleration: number;
  private readonly airAcceleration: number;
  private readonly airDeceleration: number;
  private readonly jumpSpeed: number;

  private moveInput: number;
  private jumpQueued: boolean;
  private grounded: boolean;

  public constructor(
    body: RigidBody,
    options: CharacterControllerOptions = {},
  ) {
    this.body = body;
    this.maxSpeed = options.maxSpeed ?? 300;
    this.acceleration = options.acceleration ?? 2400;
    this.deceleration = options.deceleration ?? 2800;
    this.airAcceleration = options.airAcceleration ?? 1600;
    this.airDeceleration = options.airDeceleration ?? 1000;
    this.jumpSpeed = options.jumpSpeed ?? 600;

    this.moveInput = 0;
    this.jumpQueued = false;
    this.grounded = false;
  }

  public setMoveInput(value: number): this {
    this.moveInput = clamp(value, -1, 1);
    return this;
  }

  public setGrounded(value: boolean): this {
    this.grounded = value;
    return this;
  }

  public jump(): this {
    this.jumpQueued = true;
    return this;
  }

  public stop(): this {
    this.moveInput = 0;
    return this;
  }

  public getState(): CharacterControllerState {
    return {
      moveInput: this.moveInput,
      grounded: this.grounded,
      jumpQueued: this.jumpQueued,
    };
  }

  public update(deltaTime: number): void {
    if (deltaTime <= 0) {
      return;
    }

    const velocity = this.body.getLinearVelocity();
    const targetVelocityX = this.moveInput * this.maxSpeed;
    const currentVelocityX = velocity.x;

    const acceleration = this.resolveAcceleration(
      targetVelocityX,
      currentVelocityX,
    );
    const nextVelocityX = moveTowards(
      currentVelocityX,
      targetVelocityX,
      acceleration * deltaTime,
    );

    let nextVelocityY = velocity.y;

    if (this.jumpQueued && this.grounded) {
      nextVelocityY = -this.jumpSpeed;
      this.grounded = false;
    }

    this.body.setLinearVelocity(nextVelocityX, nextVelocityY);
    this.jumpQueued = false;
  }

  private resolveAcceleration(
    targetVelocityX: number,
    currentVelocityX: number,
  ): number {
    const isAccelerating = Math.abs(targetVelocityX) > 0.0001;
    const sameDirection =
      Math.sign(targetVelocityX) === Math.sign(currentVelocityX);

    if (this.grounded) {
      if (!isAccelerating) {
        return this.deceleration;
      }

      return sameDirection ? this.acceleration : this.deceleration;
    }

    if (!isAccelerating) {
      return this.airDeceleration;
    }

    return sameDirection ? this.airAcceleration : this.airDeceleration;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function moveTowards(
  current: number,
  target: number,
  maxDelta: number,
): number {
  const delta = target - current;

  if (Math.abs(delta) <= maxDelta) {
    return target;
  }

  return current + Math.sign(delta) * maxDelta;
}
