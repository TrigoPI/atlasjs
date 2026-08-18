import { describe, expect, it } from "vitest";

import type { AudioClip } from "@atlasjs/audio";

import { SpinAttack } from "../../../../../src/game/scripts/weapon/attacks/SpinAttack";
import { SwingAttack } from "../../../../../src/game/scripts/weapon/attacks/SwingAttack";
import { ThrustAttack } from "../../../../../src/game/scripts/weapon/attacks/ThrustAttack";
import type { WeaponAttack } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";

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

function createClip(): AudioClip {
  return {} as unknown as AudioClip;
}

function injectField(
  attack: WeaponAttack,
  field: string,
  value: unknown,
): void {
  const injected: Record<string, unknown> = attack as unknown as Record<
    string,
    unknown
  >;

  injected[field] = value;
}

describe("WeaponAttack playClip guard", () => {
  it("does not throw when begin() is called on a bare pattern instance, exactly like the existing pattern test files do", () => {
    expect(() => new ThrustAttack().begin()).not.toThrow();
    expect(() => new SwingAttack().begin()).not.toThrow();
    expect(() => new SpinAttack().begin()).not.toThrow();
  });

  it("plays the clip with the injected pitch and volume once an audio service and a clip are present", () => {
    const attack: SwingAttack = new SwingAttack();
    const audio: FakeAudioApi = new FakeAudioApi();
    const clip: AudioClip = createClip();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", clip);
    injectField(attack, "pitch", 1.1);
    injectField(attack, "volume", 0.8);

    attack.begin();

    expect(audio.calls).toHaveLength(1);
    expect(audio.calls[0].clip).toBe(clip);
    expect(audio.calls[0].params).toEqual({ pitch: 1.1, volume: 0.8 });
  });

  it("does not call playOneShot when the audio service is present but no clip was injected", () => {
    const attack: ThrustAttack = new ThrustAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    injectField(attack, "audio", audio);

    attack.begin();

    expect(audio.calls).toHaveLength(0);
  });

  it("does not call playOneShot when a clip is injected but no audio service is present", () => {
    const attack: SpinAttack = new SpinAttack();
    const clip: AudioClip = createClip();

    injectField(attack, "clip", clip);

    expect(() => attack.begin()).not.toThrow();
  });
});
