import { Vec2 } from "@atlasjs/math";
import { NebulaRenderer } from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

import { ShakePresets, ShakeSpec } from "./shake";

const SHAKE_REST: number = 0.01;

/**
 * The spring is integrated explicitly, which diverges once the step grows
 * past its stability limit. The step is derived from the active spec, so
 * any preset stays stable at any frame rate; the catch-up is bounded so a
 * long stall does not replay as a burst of shake.
 */
const SHAKE_MAX_STEP: number = 1 / 120;
const SHAKE_MAX_CATCH_UP: number = 1 / 10;

export class CameraManager {
  private readonly renderer: NebulaRenderer;
  private readonly shakeOffset: Vec2;
  private readonly shakeVelocity: Vec2;

  private shakeSpec: ShakeSpec;
  private active: Entity | undefined;

  public constructor(renderer: NebulaRenderer) {
    this.renderer = renderer;
    this.shakeOffset = new Vec2();
    this.shakeVelocity = new Vec2();
    this.shakeSpec = ShakePresets.medium;
    this.active = undefined;
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

  /**
   * Kicks the camera off-centre along `direction`; the spec's spring pulls
   * it back. `direction` need not be normalised and defaults to a straight
   * up kick. A new shake replaces the one in flight.
   */
  public shake(spec: ShakeSpec, direction?: Vec2): void {
    if (spec.strength <= 0 || spec.stiffness <= 0 || spec.damping < 0) {
      return;
    }

    this.shakeSpec = spec;

    if (direction === undefined) {
      this.shakeVelocity.set(0, spec.strength);
      return;
    }

    const magnitude: number = direction.mag();

    if (magnitude === 0) {
      this.shakeVelocity.set(0, spec.strength);
      return;
    }

    this.shakeVelocity.set(
      (direction.x / magnitude) * spec.strength,
      (direction.y / magnitude) * spec.strength,
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

    const maxStep: number = this.stableShakeStep();
    let remaining: number = Math.min(dt, SHAKE_MAX_CATCH_UP);

    while (remaining > 0) {
      const step: number = Math.min(maxStep, remaining);
      this.integrateShake(step);
      remaining -= step;
    }
  }

  /** Largest step the explicit integrator stays stable at for this spec. */
  private stableShakeStep(): number {
    const bySpring: number = 1 / Math.sqrt(this.shakeSpec.stiffness);
    const byDamping: number =
      this.shakeSpec.damping > 0 ? 1 / this.shakeSpec.damping : SHAKE_MAX_STEP;

    return Math.min(SHAKE_MAX_STEP, bySpring, byDamping);
  }

  private integrateShake(dt: number): void {
    const stiffness: number = this.shakeSpec.stiffness;
    const damping: number = this.shakeSpec.damping;

    this.shakeVelocity.set(
      this.shakeVelocity.x +
        (-stiffness * this.shakeOffset.x - damping * this.shakeVelocity.x) * dt,
      this.shakeVelocity.y +
        (-stiffness * this.shakeOffset.y - damping * this.shakeVelocity.y) * dt,
    );

    this.shakeOffset.set(
      this.shakeOffset.x + this.shakeVelocity.x * dt,
      this.shakeOffset.y + this.shakeVelocity.y * dt,
    );
  }
}
