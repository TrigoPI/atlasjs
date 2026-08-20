import { describe, expect, it } from "vitest";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { SpinAttack } from "../../../../../src/game/scripts/weapon/attacks/SpinAttack";

function createPose(): AttackPose {
  return { angleOffset: 0, radiusScale: 0, scale: 0 };
}

describe("SpinAttack", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new SpinAttack()).not.toThrow();
  });

  it("duration is the sum of the three phases", () => {
    const attack: SpinAttack = new SpinAttack();
    expect(attack.duration).toBeCloseTo(0.16 + 0.26 + 0.14);
  });

  it("is neutral at t=0", () => {
    const attack: SpinAttack = new SpinAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(0, pose);

    expect(pose.angleOffset).toBeCloseTo(0);
    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.scale).toBeCloseTo(1);
  });

  it("windup phase moves angleOffset from 0 toward -windupAngle and keeps radiusScale/scale at 1", () => {
    const attack: SpinAttack = new SpinAttack();
    const pose: AttackPose = createPose();
    const windupDuration: number = 0.16;
    const windupAngle: number = 0.4;

    attack.begin();

    attack.sample(0.05, pose);
    expect(pose.angleOffset).toBeLessThan(0);
    expect(pose.angleOffset).toBeGreaterThan(-windupAngle);
    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.scale).toBeCloseTo(1);

    attack.sample(windupDuration - 1e-6, pose);
    expect(pose.angleOffset).toBeCloseTo(-windupAngle, 2);
    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.scale).toBeCloseTo(1);
  });

  it("windup phase mid-point locks the inOutQuad curve identity", () => {
    const attack: SpinAttack = new SpinAttack();
    const pose: AttackPose = createPose();
    const windupDuration: number = 0.16;
    const windupAngle: number = 0.4;
    const easedMidpoint: number = 0.5;
    const expectedAngleOffset: number = 0 + (-windupAngle - 0) * easedMidpoint;

    attack.begin();
    attack.sample(windupDuration / 2, pose);

    expect(pose.angleOffset).toBeCloseTo(expectedAngleOffset);
  });

  it("spin phase sweeps angleOffset upward from -windupAngle to PI_2*revolutions and grows radiusScale/scale toward their targets", () => {
    const attack: SpinAttack = new SpinAttack();
    const pose: AttackPose = createPose();
    const windupDuration: number = 0.16;
    const spinDuration: number = 0.26;
    const windupAngle: number = 0.4;
    const spinRadius: number = 1.3;
    const spinScale: number = 1.2;
    const finalAngleOffset: number = Math.PI * 2;

    attack.begin();

    attack.sample(windupDuration, pose);
    expect(pose.angleOffset).toBeCloseTo(-windupAngle);
    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.scale).toBeCloseTo(1);

    let previousAngleOffset: number = pose.angleOffset;
    let sawIncrease: boolean = false;

    for (
      let t: number = windupDuration;
      t < windupDuration + spinDuration;
      t += spinDuration / 20
    ) {
      attack.sample(t, pose);
      expect(pose.angleOffset).toBeGreaterThanOrEqual(previousAngleOffset);
      if (pose.angleOffset > previousAngleOffset) {
        sawIncrease = true;
      }
      previousAngleOffset = pose.angleOffset;
    }

    expect(sawIncrease).toBe(true);

    attack.sample(windupDuration + spinDuration / 2, pose);
    expect(pose.radiusScale).toBeGreaterThan(1);
    expect(pose.radiusScale).toBeLessThan(spinRadius);
    expect(pose.scale).toBeGreaterThan(1);
    expect(pose.scale).toBeLessThan(spinScale);

    attack.sample(windupDuration + spinDuration, pose);
    expect(pose.angleOffset).toBeCloseTo(finalAngleOffset);
    expect(pose.radiusScale).toBeCloseTo(spinRadius);
    expect(pose.scale).toBeCloseTo(spinScale);
  });

  it("spin phase mid-point locks the outCubic curve identity", () => {
    const attack: SpinAttack = new SpinAttack();
    const pose: AttackPose = createPose();
    const windupDuration: number = 0.16;
    const spinDuration: number = 0.26;
    const windupAngle: number = 0.4;
    const spinRadius: number = 1.3;
    const spinScale: number = 1.2;
    const finalAngleOffset: number = Math.PI * 2;
    const easedMidpoint: number = 0.875;
    const expectedAngleOffset: number =
      -windupAngle + (finalAngleOffset - -windupAngle) * easedMidpoint;
    const expectedRadiusScale: number = 1 + (spinRadius - 1) * easedMidpoint;
    const expectedScale: number = 1 + (spinScale - 1) * easedMidpoint;

    attack.begin();
    attack.sample(windupDuration + spinDuration / 2, pose);

    expect(pose.angleOffset).toBeCloseTo(expectedAngleOffset);
    expect(pose.radiusScale).toBeCloseTo(expectedRadiusScale);
    expect(pose.scale).toBeCloseTo(expectedScale);
  });

  it("end of the spin lands angleOffset exactly on PI_2*revolutions, i.e. aligned back on the aim direction", () => {
    const attack: SpinAttack = new SpinAttack();
    const pose: AttackPose = createPose();
    const windupDuration: number = 0.16;
    const spinDuration: number = 0.26;
    const finalAngleOffset: number = Math.PI * 2;

    attack.begin();
    attack.sample(windupDuration + spinDuration, pose);

    expect(pose.angleOffset).toBeCloseTo(finalAngleOffset);
    expect(Math.cos(pose.angleOffset)).toBeCloseTo(1);
    expect(Math.sin(pose.angleOffset)).toBeCloseTo(0);
  });

  it("recover phase keeps angleOffset constant and returns radiusScale/scale to 1 by t=duration", () => {
    const attack: SpinAttack = new SpinAttack();
    const pose: AttackPose = createPose();
    const windupDuration: number = 0.16;
    const spinDuration: number = 0.26;
    const recoverDuration: number = 0.14;
    const finalAngleOffset: number = Math.PI * 2;
    const recoverStart: number = windupDuration + spinDuration;

    attack.begin();

    attack.sample(recoverStart + recoverDuration * 0.3, pose);
    expect(pose.angleOffset).toBeCloseTo(finalAngleOffset);
    const midRadiusScale: number = pose.radiusScale;
    const midScale: number = pose.scale;

    attack.sample(recoverStart + recoverDuration * 0.7, pose);
    expect(pose.angleOffset).toBeCloseTo(finalAngleOffset);
    expect(pose.radiusScale).toBeLessThan(midRadiusScale);
    expect(pose.scale).toBeLessThan(midScale);

    attack.sample(attack.duration, pose);
    expect(pose.angleOffset).toBeCloseTo(finalAngleOffset);
    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.scale).toBeCloseTo(1);
  });

  it("clamps past duration without NaN or drift", () => {
    const attack: SpinAttack = new SpinAttack();
    const pose: AttackPose = createPose();
    const finalAngleOffset: number = Math.PI * 2;

    attack.begin();
    attack.sample(attack.duration + 5, pose);

    expect(Number.isNaN(pose.angleOffset)).toBe(false);
    expect(Number.isNaN(pose.radiusScale)).toBe(false);
    expect(Number.isNaN(pose.scale)).toBe(false);
    expect(pose.angleOffset).toBeCloseTo(finalAngleOffset);
    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.scale).toBeCloseTo(1);
  });

  it("revolutions=2 keeps duration unchanged and lands the spin on PI_2*2", () => {
    const attack: SpinAttack = new SpinAttack();
    const injected: Record<string, unknown> = attack as unknown as Record<
      string,
      unknown
    >;
    injected.revolutions = 2;

    const windupDuration: number = 0.16;
    const spinDuration: number = 0.26;
    const finalAngleOffset: number = Math.PI * 2 * 2;

    expect(attack.duration).toBeCloseTo(0.16 + 0.26 + 0.14);

    const pose: AttackPose = createPose();
    attack.begin();
    attack.sample(windupDuration + spinDuration, pose);

    expect(pose.angleOffset).toBeCloseTo(finalAngleOffset);
    expect(Math.cos(pose.angleOffset)).toBeCloseTo(1);
    expect(Math.sin(pose.angleOffset)).toBeCloseTo(0);
  });

  it("lets injected values override the defaults", () => {
    const attack: SpinAttack = new SpinAttack();
    const injected: Record<string, unknown> = attack as unknown as Record<
      string,
      unknown
    >;

    injected.windupDuration = 1;
    injected.spinDuration = 1;
    injected.recoverDuration = 1;
    injected.windupAngle = Math.PI / 4;
    injected.spinRadius = 2;
    injected.spinScale = 3;
    injected.revolutions = 2;

    expect(attack.duration).toBeCloseTo(3);

    const pose: AttackPose = createPose();
    attack.begin();

    attack.sample(1 - 1e-6, pose);
    expect(pose.angleOffset).toBeCloseTo(-Math.PI / 4, 2);
    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.scale).toBeCloseTo(1);

    attack.sample(2, pose);
    expect(pose.angleOffset).toBeCloseTo(Math.PI * 2 * 2);
    expect(pose.radiusScale).toBeCloseTo(2);
    expect(pose.scale).toBeCloseTo(3);

    attack.sample(3, pose);
    expect(pose.angleOffset).toBeCloseTo(Math.PI * 2 * 2);
    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.scale).toBeCloseTo(1);
  });
});
