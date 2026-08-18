import { describe, expect, it } from "vitest";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { SwingAttack } from "../../../../../src/game/scripts/weapon/attacks/SwingAttack";

function createPose(): AttackPose {
  return { angleOffset: 0, radiusScale: 0, scale: 0 };
}

describe("SwingAttack", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new SwingAttack()).not.toThrow();
  });

  it("duration is the sum of the three phases", () => {
    const attack: SwingAttack = new SwingAttack();
    expect(attack.duration).toBeCloseTo(0.3 + 0.09 + 0.18);
  });

  it("impactTime is windupDuration + strikeDuration * 0.5", () => {
    const attack: SwingAttack = new SwingAttack();
    expect(attack.impactTime).toBeCloseTo(0.3 + 0.09 * 0.5);
  });

  it("impactTime stays within [0, duration]", () => {
    const attack: SwingAttack = new SwingAttack();
    expect(attack.impactTime).toBeGreaterThanOrEqual(0);
    expect(attack.impactTime).toBeLessThanOrEqual(attack.duration);
  });

  it("impactTime follows injected windup/strike duration settings", () => {
    const attack: SwingAttack = new SwingAttack();
    const injected: Record<string, unknown> = attack as unknown as Record<
      string,
      unknown
    >;

    injected.windupDuration = 1;
    injected.strikeDuration = 2;

    expect(attack.impactTime).toBeCloseTo(1 + 2 * 0.5);
  });

  it("is neutral at t=0", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(0, pose);

    expect(pose.angleOffset).toBeCloseTo(0);
    expect(pose.scale).toBeCloseTo(1);
    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("windup phase moves angleOffset from 0 toward +windupAngle and keeps scale at 1", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();
    const windupAngle: number = Math.PI * 0.3;

    attack.begin();

    attack.sample(0.05, pose);
    expect(pose.angleOffset).toBeGreaterThan(0);
    expect(pose.angleOffset).toBeLessThan(windupAngle);
    expect(pose.scale).toBeCloseTo(1);

    attack.sample(0.3 - 1e-6, pose);
    expect(pose.angleOffset).toBeCloseTo(windupAngle, 2);
    expect(pose.scale).toBeCloseTo(1);
  });

  it("windup phase mid-point locks the inOutQuad curve identity", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();
    const windupDuration: number = 0.3;
    const windupAngle: number = Math.PI * 0.3;
    const easedMidpoint: number = 0.5;
    const expectedAngleOffset: number = windupAngle * easedMidpoint;

    attack.begin();
    attack.sample(windupDuration / 2, pose);

    expect(pose.angleOffset).toBeCloseTo(expectedAngleOffset);
  });

  it("strike phase sweeps angleOffset from +windupAngle to -strikeAngle and scale toward strikeScale", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();
    const windupAngle: number = Math.PI * 0.3;
    const strikeAngle: number = Math.PI * 0.55;

    attack.begin();

    attack.sample(0.3, pose);
    expect(pose.angleOffset).toBeCloseTo(windupAngle);
    expect(pose.scale).toBeCloseTo(1);

    attack.sample(0.3 + 0.09 / 2, pose);
    expect(pose.angleOffset).toBeLessThan(windupAngle);

    attack.sample(0.3 + 0.09 - 1e-6, pose);
    expect(pose.angleOffset).toBeCloseTo(-strikeAngle, 2);
    expect(pose.scale).toBeCloseTo(1.5, 2);

    let sawSignChange: boolean = false;
    for (let t: number = 0.3; t < 0.3 + 0.09; t += 0.01) {
      attack.sample(t, pose);
      if (pose.angleOffset < 0) {
        sawSignChange = true;
        break;
      }
    }
    expect(sawSignChange).toBe(true);
  });

  it("strike phase mid-point locks the outCubic curve identity", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();
    const windupDuration: number = 0.3;
    const strikeDuration: number = 0.09;
    const windupAngle: number = Math.PI * 0.3;
    const strikeAngle: number = Math.PI * 0.55;
    const strikeScale: number = 1.5;
    const easedMidpoint: number = 0.875;
    const expectedAngleOffset: number =
      windupAngle + (-strikeAngle - windupAngle) * easedMidpoint;
    const expectedScale: number = 1 + (strikeScale - 1) * easedMidpoint;

    attack.begin();
    attack.sample(windupDuration + strikeDuration / 2, pose);

    expect(pose.angleOffset).toBeCloseTo(expectedAngleOffset);
    expect(pose.scale).toBeCloseTo(expectedScale);
  });

  it("recover phase returns angleOffset to 0 and scale to 1 by t=duration", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration, pose);

    expect(pose.angleOffset).toBeCloseTo(0);
    expect(pose.scale).toBeCloseTo(1);
    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("clamps past duration without NaN or drift", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration + 5, pose);

    expect(Number.isNaN(pose.angleOffset)).toBe(false);
    expect(Number.isNaN(pose.scale)).toBe(false);
    expect(pose.angleOffset).toBeCloseTo(0);
    expect(pose.scale).toBeCloseTo(1);
    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("keeps radiusScale at 1 across the whole timeline", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    for (let t: number = 0; t <= attack.duration + 1; t += 0.03) {
      attack.sample(t, pose);
      expect(pose.radiusScale).toBe(1);
    }
  });

  it("lets injected values override the defaults", () => {
    const attack: SwingAttack = new SwingAttack();
    const injected: Record<string, unknown> = attack as unknown as Record<
      string,
      unknown
    >;

    injected.windupDuration = 1;
    injected.strikeDuration = 1;
    injected.recoverDuration = 1;
    injected.windupAngle = Math.PI / 2;
    injected.strikeAngle = Math.PI / 2;
    injected.strikeScale = 3;

    expect(attack.duration).toBeCloseTo(3);

    const pose: AttackPose = createPose();
    attack.begin();

    attack.sample(1 - 1e-6, pose);
    expect(pose.angleOffset).toBeCloseTo(Math.PI / 2, 2);

    attack.sample(2 - 1e-6, pose);
    expect(pose.angleOffset).toBeCloseTo(-Math.PI / 2, 2);
    expect(pose.scale).toBeCloseTo(3, 2);

    attack.sample(3, pose);
    expect(pose.angleOffset).toBeCloseTo(0);
    expect(pose.scale).toBeCloseTo(1);
  });
});
