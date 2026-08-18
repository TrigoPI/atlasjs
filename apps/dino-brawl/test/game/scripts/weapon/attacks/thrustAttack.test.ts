import { describe, expect, it } from "vitest";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { ThrustAttack } from "../../../../../src/game/scripts/weapon/attacks/ThrustAttack";

function createPose(): AttackPose {
  return { angleOffset: 0, radiusScale: 0, scale: 0 };
}

describe("ThrustAttack", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new ThrustAttack()).not.toThrow();
  });

  it("duration is the sum of the four phases", () => {
    const attack: ThrustAttack = new ThrustAttack();
    expect(attack.duration).toBeCloseTo(0.22 + 0.07 + 0.05 + 0.2);
  });

  it("impactTime is pullbackDuration + thrustDuration", () => {
    const attack: ThrustAttack = new ThrustAttack();
    expect(attack.impactTime).toBeCloseTo(0.22 + 0.07);
  });

  it("impactTime stays within [0, duration]", () => {
    const attack: ThrustAttack = new ThrustAttack();
    expect(attack.impactTime).toBeGreaterThanOrEqual(0);
    expect(attack.impactTime).toBeLessThanOrEqual(attack.duration);
  });

  it("impactTime follows injected pullback/thrust duration settings", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const injected: Record<string, unknown> = attack as unknown as Record<
      string,
      unknown
    >;

    injected.pullbackDuration = 1;
    injected.thrustDuration = 2;

    expect(attack.impactTime).toBeCloseTo(1 + 2);
  });

  it("keeps angleOffset at 0 and scale at 1 across the whole timeline", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    for (let t: number = 0; t <= attack.duration + 1; t += 0.03) {
      attack.sample(t, pose);
      expect(pose.angleOffset).toBe(0);
      expect(pose.scale).toBe(1);
    }

    attack.sample(0.22, pose);
    expect(pose.angleOffset).toBe(0);
    expect(pose.scale).toBe(1);

    attack.sample(0.22 + 0.07, pose);
    expect(pose.angleOffset).toBe(0);
    expect(pose.scale).toBe(1);

    attack.sample(0.22 + 0.07 + 0.05, pose);
    expect(pose.angleOffset).toBe(0);
    expect(pose.scale).toBe(1);

    attack.sample(attack.duration, pose);
    expect(pose.angleOffset).toBe(0);
    expect(pose.scale).toBe(1);
  });

  it("is neutral at t=0", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(0, pose);

    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("pullback phase moves radiusScale from 1 toward pullbackRadius", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();
    const pullbackRadius: number = 0.55;

    attack.begin();

    attack.sample(0.05, pose);
    expect(pose.radiusScale).toBeLessThan(1);
    expect(pose.radiusScale).toBeGreaterThan(pullbackRadius);

    attack.sample(0.22 - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(pullbackRadius, 2);
  });

  it("pullback phase mid-point locks the inOutQuad curve identity", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();
    const pullbackDuration: number = 0.22;
    const pullbackRadius: number = 0.55;
    const easedMidpoint: number = 0.5;
    const expectedRadiusScale: number =
      1 + (pullbackRadius - 1) * easedMidpoint;

    attack.begin();
    attack.sample(pullbackDuration / 2, pose);

    expect(pose.radiusScale).toBeCloseTo(expectedRadiusScale);
  });

  it("thrust phase moves radiusScale from pullbackRadius toward thrustRadius", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();
    const pullbackDuration: number = 0.22;
    const thrustDuration: number = 0.07;
    const pullbackRadius: number = 0.55;
    const thrustRadius: number = 1.85;

    attack.begin();

    attack.sample(pullbackDuration, pose);
    expect(pose.radiusScale).toBeCloseTo(pullbackRadius, 2);

    attack.sample(pullbackDuration + thrustDuration / 2, pose);
    expect(pose.radiusScale).toBeGreaterThan(pullbackRadius);
    expect(pose.radiusScale).toBeLessThan(thrustRadius);

    attack.sample(pullbackDuration + thrustDuration - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(thrustRadius, 2);
  });

  it("thrust phase mid-point locks the outCubic curve identity", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();
    const pullbackDuration: number = 0.22;
    const thrustDuration: number = 0.07;
    const pullbackRadius: number = 0.55;
    const thrustRadius: number = 1.85;
    const easedMidpoint: number = 0.875;
    const expectedRadiusScale: number =
      pullbackRadius + (thrustRadius - pullbackRadius) * easedMidpoint;

    attack.begin();
    attack.sample(pullbackDuration + thrustDuration / 2, pose);

    expect(pose.radiusScale).toBeCloseTo(expectedRadiusScale);
  });

  it("hold phase keeps radiusScale exactly at thrustRadius", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const pose: AttackPose = createPose();
    const pullbackDuration: number = 0.22;
    const thrustDuration: number = 0.07;
    const holdDuration: number = 0.05;
    const thrustRadius: number = 1.85;
    const holdStart: number = pullbackDuration + thrustDuration;

    attack.begin();

    attack.sample(holdStart, pose);
    expect(pose.radiusScale).toBe(thrustRadius);

    attack.sample(holdStart + holdDuration / 2, pose);
    expect(pose.radiusScale).toBe(thrustRadius);

    attack.sample(holdStart + holdDuration - 1e-6, pose);
    expect(pose.radiusScale).toBe(thrustRadius);
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

  it("lets injected values override the defaults", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const injected: Record<string, unknown> = attack as unknown as Record<
      string,
      unknown
    >;

    injected.pullbackDuration = 1;
    injected.thrustDuration = 1;
    injected.holdDuration = 1;
    injected.recoverDuration = 1;
    injected.pullbackRadius = 0.2;
    injected.thrustRadius = 3;

    expect(attack.duration).toBeCloseTo(4);

    const pose: AttackPose = createPose();
    attack.begin();

    attack.sample(1 - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(0.2, 2);

    attack.sample(2 - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(3, 2);

    attack.sample(2.5, pose);
    expect(pose.radiusScale).toBe(3);

    attack.sample(4, pose);
    expect(pose.radiusScale).toBeCloseTo(1);
  });
});
