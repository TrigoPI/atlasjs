import { describe, expect, it } from "vitest";

import { Easing, MathUtils } from "@atlasjs/math";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { SwingAttack } from "../../../../../src/game/scripts/weapon/attacks/SwingAttack";

const STRIKE_DURATION: number = 0.09;
const RECOVER_DURATION: number = 0.18;
const WINDUP_ANGLE: number = Math.PI * 0.3;
const STRIKE_ANGLE: number = Math.PI * 0.55;

function createPose(): AttackPose {
  return { angleOffset: 0, radiusScale: 0, scale: 0 };
}

describe("SwingAttack", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new SwingAttack()).not.toThrow();
  });

  it("duration is the sum of the two phases", () => {
    const attack: SwingAttack = new SwingAttack();
    expect(attack.duration).toBeCloseTo(STRIKE_DURATION + RECOVER_DURATION);
  });

  it("starts the strike already raised at +windupAngle", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(0, pose);

    expect(pose.angleOffset).toBeCloseTo(WINDUP_ANGLE);
    expect(pose.radiusScale).toBe(1);
    expect(pose.scale).toBe(1);
  });

  it("strike phase sweeps angleOffset from +windupAngle to -strikeAngle", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    attack.sample(STRIKE_DURATION / 2, pose);
    expect(pose.angleOffset).toBeLessThan(WINDUP_ANGLE);

    attack.sample(STRIKE_DURATION - 1e-6, pose);
    expect(pose.angleOffset).toBeCloseTo(-STRIKE_ANGLE, 2);

    let sawSignChange: boolean = false;
    for (let t: number = 0; t < STRIKE_DURATION; t += 0.005) {
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
    const eased: number = Easing.outCubic(0.5);
    const expected: number = MathUtils.lerp(WINDUP_ANGLE, -STRIKE_ANGLE, eased);

    attack.begin();
    attack.sample(STRIKE_DURATION / 2, pose);

    expect(pose.angleOffset).toBeCloseTo(expected);
  });

  it("recover phase picks up exactly where the strike left off", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(STRIKE_DURATION, pose);

    expect(pose.angleOffset).toBeCloseTo(-STRIKE_ANGLE);
  });

  it("recover phase mid-point locks the inOutQuad curve identity", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();
    const eased: number = Easing.inOutQuad(0.5);
    const expected: number = MathUtils.lerp(-STRIKE_ANGLE, 0, eased);

    attack.begin();
    attack.sample(STRIKE_DURATION + RECOVER_DURATION / 2, pose);

    expect(pose.angleOffset).toBeCloseTo(expected);
  });

  it("recover phase returns angleOffset to 0 by t=duration", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration, pose);

    expect(pose.angleOffset).toBeCloseTo(0);
  });

  it("clamps past duration without NaN or drift", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration + 5, pose);

    expect(Number.isNaN(pose.angleOffset)).toBe(false);
    expect(pose.angleOffset).toBeCloseTo(0);
    expect(pose.radiusScale).toBe(1);
    expect(pose.scale).toBe(1);
  });

  it("writes every pose channel on every sample", () => {
    const attack: SwingAttack = new SwingAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    for (let t: number = 0; t <= attack.duration + 1; t += 0.01) {
      pose.angleOffset = Number.NaN;
      pose.radiusScale = Number.NaN;
      pose.scale = Number.NaN;

      attack.sample(t, pose);

      expect(Number.isNaN(pose.angleOffset)).toBe(false);
      expect(pose.radiusScale).toBe(1);
      expect(pose.scale).toBe(1);
    }
  });

  it("lets injected values override the defaults", () => {
    const attack: SwingAttack = new SwingAttack();
    const injected: Record<string, unknown> = attack as unknown as Record<
      string,
      unknown
    >;

    injected.strikeDuration = 1;
    injected.recoverDuration = 1;
    injected.windupAngle = Math.PI / 2;
    injected.strikeAngle = Math.PI / 2;

    expect(attack.duration).toBeCloseTo(2);

    const pose: AttackPose = createPose();
    attack.begin();

    attack.sample(0, pose);
    expect(pose.angleOffset).toBeCloseTo(Math.PI / 2);

    attack.sample(1 - 1e-6, pose);
    expect(pose.angleOffset).toBeCloseTo(-Math.PI / 2, 2);

    attack.sample(2, pose);
    expect(pose.angleOffset).toBeCloseTo(0);
  });
});
