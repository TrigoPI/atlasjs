import { describe, expect, it } from "vitest";

import { Easing, MathUtils } from "@atlasjs/math";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { ThrustAttack } from "../../../../../src/game/scripts/weapon/attacks/ThrustAttack";

const THRUST_DURATION: number = 0.07;
const HOLD_DURATION: number = 0.05;
const RECOVER_DURATION: number = 0.2;
const PULLBACK_RADIUS: number = 0.55;
const THRUST_RADIUS: number = 1.85;

const HOLD_START: number = THRUST_DURATION;
const RECOVER_START: number = THRUST_DURATION + HOLD_DURATION;

function createPose(): AttackPose {
  return { angleOffset: 0, radiusScale: 0, scale: 0 };
}

describe("ThrustAttack", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new ThrustAttack()).not.toThrow();
  });

  it("duration is the sum of the three phases", () => {
    const attack: ThrustAttack = new ThrustAttack();
    expect(attack.duration).toBeCloseTo(
      THRUST_DURATION + HOLD_DURATION + RECOVER_DURATION,
    );
  });

  it("keeps angleOffset at 0 and scale at 1 across the whole timeline", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    for (let t: number = 0; t <= attack.duration + 1; t += 0.01) {
      attack.sample(t, pose);
      expect(pose.angleOffset).toBe(0);
      expect(pose.scale).toBe(1);
    }
  });

  it("starts the thrust already pulled back to pullbackRadius", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(0, pose);

    expect(pose.radiusScale).toBeCloseTo(PULLBACK_RADIUS);
  });

  it("thrust phase moves radiusScale from pullbackRadius toward thrustRadius", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    attack.sample(THRUST_DURATION / 2, pose);
    expect(pose.radiusScale).toBeGreaterThan(PULLBACK_RADIUS);
    expect(pose.radiusScale).toBeLessThan(THRUST_RADIUS);

    attack.sample(THRUST_DURATION - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(THRUST_RADIUS, 2);
  });

  it("thrust phase mid-point locks the outCubic curve identity", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();
    const eased: number = Easing.outCubic(0.5);
    const expected: number = MathUtils.lerp(
      PULLBACK_RADIUS,
      THRUST_RADIUS,
      eased,
    );

    attack.begin();
    attack.sample(THRUST_DURATION / 2, pose);

    expect(pose.radiusScale).toBeCloseTo(expected);
  });

  it("hold phase keeps radiusScale exactly at thrustRadius", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    attack.sample(HOLD_START, pose);
    expect(pose.radiusScale).toBe(THRUST_RADIUS);

    attack.sample(HOLD_START + HOLD_DURATION / 2, pose);
    expect(pose.radiusScale).toBe(THRUST_RADIUS);

    attack.sample(RECOVER_START - 1e-6, pose);
    expect(pose.radiusScale).toBe(THRUST_RADIUS);
  });

  it("recover phase mid-point locks the inOutQuad curve identity", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();
    const eased: number = Easing.inOutQuad(0.5);
    const expected: number = MathUtils.lerp(THRUST_RADIUS, 1, eased);

    attack.begin();
    attack.sample(RECOVER_START + RECOVER_DURATION / 2, pose);

    expect(pose.radiusScale).toBeCloseTo(expected);
  });

  it("recover phase returns radiusScale to 1 by t=duration", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration, pose);

    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("clamps past duration without NaN or drift", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration + 5, pose);

    expect(Number.isNaN(pose.radiusScale)).toBe(false);
    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("writes every pose channel on every sample", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    for (let t: number = 0; t <= attack.duration + 1; t += 0.01) {
      pose.angleOffset = Number.NaN;
      pose.radiusScale = Number.NaN;
      pose.scale = Number.NaN;

      attack.sample(t, pose);

      expect(pose.angleOffset).toBe(0);
      expect(Number.isNaN(pose.radiusScale)).toBe(false);
      expect(pose.scale).toBe(1);
    }
  });

  it("lets injected values override the defaults", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const injected: Record<string, unknown> = attack as unknown as Record<
      string,
      unknown
    >;

    injected.thrustDuration = 1;
    injected.holdDuration = 1;
    injected.recoverDuration = 1;
    injected.pullbackRadius = 0.2;
    injected.thrustRadius = 3;

    expect(attack.duration).toBeCloseTo(3);

    const pose: AttackPose = createPose();
    attack.begin();

    attack.sample(0, pose);
    expect(pose.radiusScale).toBeCloseTo(0.2);

    attack.sample(1 - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(3, 2);

    attack.sample(1.5, pose);
    expect(pose.radiusScale).toBe(3);

    attack.sample(3, pose);
    expect(pose.radiusScale).toBeCloseTo(1);
  });
});
