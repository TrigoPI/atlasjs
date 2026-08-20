import { Vec2 } from "@atlasjs/math";
import { NebulaRenderer } from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

const SHAKE_STIFFNESS: number = 320;
const SHAKE_DAMPING: number = 22;
const SHAKE_REST: number = 0.01;

/**
 * The spring is integrated explicitly, which diverges once the step grows
 * past ~2/sqrt(stiffness). Sub-stepping keeps it stable no matter how long
 * a frame took, and capping the catch-up stops a long stall from replaying
 * as a burst of shake.
 */
const SHAKE_MAX_STEP: number = 1 / 120;
const SHAKE_MAX_CATCH_UP: number = 1 / 10;

export class CameraManager {
  private readonly renderer: NebulaRenderer;
  private readonly shakeOffset: Vec2;
  private readonly shakeVelocity: Vec2;
  private active: Entity | undefined;

  public constructor(renderer: NebulaRenderer) {
    this.renderer = renderer;
    this.shakeOffset = new Vec2();
    this.shakeVelocity = new Vec2();
    this.active = undefined;
  }

  /**
   * Kicks the camera off-centre; a spring pulls it back. `direction` need
   * not be normalised and defaults to a straight-up kick.
   */
  public shake(strength: number, direction?: Vec2): void {
    if (strength <= 0) {
      return;
    }

    if (direction === undefined) {
      this.shakeVelocity.set(0, strength);
      return;
    }

    const magnitude: number = direction.mag();

    if (magnitude === 0) {
      this.shakeVelocity.set(0, strength);
      return;
    }

    this.shakeVelocity.set(
      (direction.x / magnitude) * strength,
      (direction.y / magnitude) * strength,
    );
  }

  public getShakeOffset(): Vec2 {
    return this.shakeOffset;
  }

  public advanceShake(dt: number): void {
    if (
      this.shakeOffset.mag() < SHAKE_REST &&
      this.shakeVelocity.mag() < SHAKE_REST
    ) {
      this.shakeOffset.set(0, 0);
      this.shakeVelocity.set(0, 0);
      return;
    }

    let remaining: number = Math.min(dt, SHAKE_MAX_CATCH_UP);

    while (remaining > 0) {
      const step: number = Math.min(SHAKE_MAX_STEP, remaining);
      this.integrateShake(step);
      remaining -= step;
    }
  }

  private integrateShake(dt: number): void {
    this.shakeVelocity.set(
      this.shakeVelocity.x +
        (-SHAKE_STIFFNESS * this.shakeOffset.x -
          SHAKE_DAMPING * this.shakeVelocity.x) *
          dt,
      this.shakeVelocity.y +
        (-SHAKE_STIFFNESS * this.shakeOffset.y -
          SHAKE_DAMPING * this.shakeVelocity.y) *
          dt,
    );

    this.shakeOffset.set(
      this.shakeOffset.x + this.shakeVelocity.x * dt,
      this.shakeOffset.y + this.shakeVelocity.y * dt,
    );
  }

  public setActive(entity: Entity | undefined): void {
    this.active = entity;
  }

  public getActive(): Entity | undefined {
    return this.active;
  }

  public screenToWorld(screen: Vec2, out?: Vec2): Vec2 {
    return this.renderer.camera.screenToWorld(screen, out);
  }

  public worldToScreen(world: Vec2, out?: Vec2): Vec2 {
    return this.renderer.camera.worldToScreen(world, out);
  }
}
