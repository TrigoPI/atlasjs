import { describe, expect, it } from "vitest";

import type { AudioClip } from "@atlasjs/audio";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { LungeAttack } from "../../../../../src/game/scripts/weapon/attacks/LungeAttack";

const WINDUP_DURATION: number = 0.12;
const EXTEND_DURATION: number = 0.06;
const HOLD_DURATION: number = 0.06;
const RECOVER_DURATION: number = 0.28;
const PULLBACK_RADIUS: number = 0.35;
const LUNGE_RADIUS: number = 3.4;

const EXTEND_START: number = WINDUP_DURATION;
const HOLD_START: number = WINDUP_DURATION + EXTEND_DURATION;
const RECOVER_START: number = HOLD_START + HOLD_DURATION;

type PlayOneShotCall = {
  clip: AudioClip;
  params: { pitch?: number; volume?: number } | undefined;
};

class FakeAudioApi {
  public readonly calls: PlayOneShotCall[] = [];

  public playOneShot(
    clip: AudioClip,
    params?: { pitch?: number; volume?: number },
  ): void {
    this.calls.push({ clip, params });
  }
}

function createPose(): AttackPose {
  return { angleOffset: 0, radiusScale: 0, scale: 0 };
}

function inject(attack: LungeAttack, fields: Record<string, unknown>): void {
  const injected: Record<string, unknown> = attack as unknown as Record<
    string,
    unknown
  >;

  for (const key of Object.keys(fields)) {
    injected[key] = fields[key];
  }
}

function play(attack: LungeAttack, step: number): number {
  const pose: AttackPose = createPose();
  let rearms: number = 0;
  let t: number = 0;

  attack.begin();

  while (t < attack.duration + step) {
    t += step;
    attack.advance(t);

    if (attack.rearmsHits) {
      rearms += 1;
    }

    attack.sample(t, pose);
  }

  return rearms;
}

describe("LungeAttack", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new LungeAttack()).not.toThrow();
  });

  it("duration is the sum of the four phases", () => {
    const attack: LungeAttack = new LungeAttack();

    expect(attack.duration).toBeCloseTo(
      WINDUP_DURATION + EXTEND_DURATION + HOLD_DURATION + RECOVER_DURATION,
    );
  });

  it("pulls the blade back to pullbackRadius by the end of the windup", () => {
    const attack: LungeAttack = new LungeAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(EXTEND_START - 1e-6, pose);

    expect(pose.radiusScale).toBeCloseTo(PULLBACK_RADIUS, 2);
  });

  it("overshoots past lungeRadius mid-extend then settles on it", () => {
    const attack: LungeAttack = new LungeAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    attack.sample(EXTEND_START + EXTEND_DURATION * 0.7, pose);
    expect(pose.radiusScale).toBeGreaterThan(LUNGE_RADIUS);

    attack.sample(HOLD_START, pose);
    expect(pose.radiusScale).toBeCloseTo(LUNGE_RADIUS, 2);
  });

  it("holds exactly at lungeRadius for the whole hold phase", () => {
    const attack: LungeAttack = new LungeAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    attack.sample(HOLD_START, pose);
    expect(pose.radiusScale).toBeCloseTo(LUNGE_RADIUS, 5);

    attack.sample(HOLD_START + HOLD_DURATION / 2, pose);
    expect(pose.radiusScale).toBeCloseTo(LUNGE_RADIUS, 5);

    attack.sample(RECOVER_START - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(LUNGE_RADIUS, 5);
  });

  it("returns radiusScale to 1 and angleOffset to 0 by the end", () => {
    const attack: LungeAttack = new LungeAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration, pose);

    expect(pose.radiusScale).toBeCloseTo(1);
    expect(pose.angleOffset).toBeCloseTo(0);
  });

  it("plays exactly one sound, on the extend", () => {
    const attack: LungeAttack = new LungeAttack();
    const audio: FakeAudioApi = new FakeAudioApi();
    const clip: AudioClip = {} as unknown as AudioClip;

    inject(attack, { audio, clip, pitch: 0.9, volume: 0.8 });
    play(attack, 0.005);

    expect(audio.calls).toHaveLength(1);
    expect(audio.calls[0].clip).toBe(clip);
    expect(audio.calls[0].params).toEqual({ pitch: 0.9, volume: 0.8 });
  });

  it("never rearms the hit window — a lunge lands one blow", () => {
    const attack: LungeAttack = new LungeAttack();

    expect(play(attack, 0.005)).toBe(0);
  });

  it("clamps past duration without NaN", () => {
    const attack: LungeAttack = new LungeAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration + 5, pose);

    expect(Number.isNaN(pose.radiusScale)).toBe(false);
    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("writes every pose channel on every sample", () => {
    const attack: LungeAttack = new LungeAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    for (let t: number = 0; t <= attack.duration + 1; t += 0.01) {
      pose.angleOffset = Number.NaN;
      pose.radiusScale = Number.NaN;
      pose.scale = Number.NaN;

      attack.sample(t, pose);

      expect(Number.isNaN(pose.angleOffset)).toBe(false);
      expect(Number.isNaN(pose.radiusScale)).toBe(false);
      expect(pose.scale).toBe(1);
    }
  });

  it("lets injected values override the defaults", () => {
    const attack: LungeAttack = new LungeAttack();

    inject(attack, {
      windupDuration: 1,
      extendDuration: 1,
      holdDuration: 1,
      recoverDuration: 1,
      lungeRadius: 5,
    });

    expect(attack.duration).toBeCloseTo(4);

    const pose: AttackPose = createPose();
    attack.begin();
    attack.sample(2, pose);

    expect(pose.radiusScale).toBeCloseTo(5, 2);
  });
});
