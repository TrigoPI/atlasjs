import { describe, expect, it } from "vitest";

import type { AudioClip } from "@atlasjs/audio";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { ThrustChainAttack } from "../../../../../src/game/scripts/weapon/attacks/ThrustChainAttack";

const THRUST_DURATION: number = 0.07;
const HOLD_DURATION: number = 0.05;
const RECOVER_DURATION: number = 0.2;
const PULLBACK_RADIUS: number = 0.55;
const THRUST_RADIUS: number = 1.85;

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

function inject(
  attack: ThrustChainAttack,
  fields: Record<string, unknown>,
): void {
  const injected: Record<string, unknown> = attack as unknown as Record<
    string,
    unknown
  >;

  for (const key of Object.keys(fields)) {
    injected[key] = fields[key];
  }
}

/** Walks the whole attack one small step at a time, as SwordScript does. */
function play(attack: ThrustChainAttack, step: number): number {
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

describe("ThrustChainAttack", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new ThrustChainAttack()).not.toThrow();
  });

  it("defaults to three thrusts plus one recover", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();

    expect(attack.duration).toBeCloseTo(
      3 * (THRUST_DURATION + HOLD_DURATION) + RECOVER_DURATION,
    );
  });

  it("scales its duration with thrustCount", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
    inject(attack, { thrustCount: 5 });

    expect(attack.duration).toBeCloseTo(
      5 * (THRUST_DURATION + HOLD_DURATION) + RECOVER_DURATION,
    );
  });

  it("rearms the hit window once per thrust", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
    inject(attack, { thrustCount: 4 });

    expect(play(attack, 0.005)).toBe(4);
  });

  it("plays one sound per thrust with a rising pitch", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    inject(attack, {
      audio,
      clip: {} as unknown as AudioClip,
      pitch: 2,
      pitchStep: 0.1,
      thrustCount: 3,
    });

    play(attack, 0.005);

    expect(audio.calls).toHaveLength(3);
    expect(audio.calls[0].params?.pitch).toBeCloseTo(2);
    expect(audio.calls[1].params?.pitch).toBeCloseTo(2.1);
    expect(audio.calls[2].params?.pitch).toBeCloseTo(2.2);
  });

  it("does not auto-play the clip on begin — the cues own the sound", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    inject(attack, { audio, clip: {} as unknown as AudioClip });
    attack.begin();

    expect(audio.calls).toHaveLength(0);
  });

  it("retracts to pullbackRadius between two thrusts", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
    const pose: AttackPose = createPose();

    attack.begin();

    attack.sample(THRUST_DURATION - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(THRUST_RADIUS, 2);

    attack.sample(THRUST_DURATION + HOLD_DURATION - 1e-6, pose);
    expect(pose.radiusScale).toBeCloseTo(PULLBACK_RADIUS, 2);
  });

  it("grows the reach by radiusStep on each thrust when asked", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
    const pose: AttackPose = createPose();

    inject(attack, { thrustCount: 2, radiusStep: 1 });
    attack.begin();

    attack.sample(THRUST_DURATION - 1e-6, pose);
    const first: number = pose.radiusScale;

    const secondEnd: number = 2 * THRUST_DURATION + HOLD_DURATION - 1e-6;
    attack.sample(secondEnd, pose);

    expect(pose.radiusScale).toBeGreaterThan(first);
    expect(pose.radiusScale).toBeCloseTo(THRUST_RADIUS + 1, 1);
  });

  it("returns radiusScale to 1 by the end of the recover", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
    const pose: AttackPose = createPose();

    attack.begin();
    attack.sample(attack.duration, pose);

    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("survives a thrustCount of 0 with only the recover left", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
    inject(attack, { thrustCount: 0 });

    expect(attack.duration).toBeCloseTo(RECOVER_DURATION);
    expect(() => play(attack, 0.01)).not.toThrow();
  });

  it("writes every pose channel on every sample", () => {
    const attack: ThrustChainAttack = new ThrustChainAttack();
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
});
