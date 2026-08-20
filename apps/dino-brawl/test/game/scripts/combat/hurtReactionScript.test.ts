import { describe, expect, it } from "vitest";

import type { AudioClip } from "@atlasjs/audio";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";
import { HurtReactionScript } from "../../../../src/game/scripts/combat/HurtReactionScript";

class FakeAnimator {
  public readonly played: string[] = [];
  private current: string = "idle";

  public play(name: string): void {
    if (name === this.current) {
      return;
    }

    this.current = name;
    this.played.push(name);
  }

  public get playing(): string {
    return this.current;
  }
}

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

type Rig = {
  hurtbox: HurtboxScript;
  animator: FakeAnimator;
  audio: FakeAudioApi;
  clip: AudioClip;
  /** Advances the hurtbox timer then the observer, as the runtime does. */
  frame: (dt: number) => void;
};

function createRig(overrides: Record<string, unknown> = {}): Rig {
  const script: HurtReactionScript = new HurtReactionScript();
  const hurtbox: HurtboxScript = new HurtboxScript();
  const animator: FakeAnimator = new FakeAnimator();
  const audio: FakeAudioApi = new FakeAudioApi();
  const clip: AudioClip = {} as unknown as AudioClip;

  const injected: Record<string, unknown> = script as unknown as Record<
    string,
    unknown
  >;

  injected.hurtbox = hurtbox;
  injected.hurtClip = "hurt";
  injected.restClip = "idle";
  injected.hitClip = clip;
  injected.hitPitch = 1;
  injected.hitVolume = 1;

  // onCreate() needs a bound script context, so resolve its two lookups here.
  injected.animator = animator;
  injected.audio = audio;
  injected.wasInvincible = false;

  for (const key of Object.keys(overrides)) {
    injected[key] = overrides[key];
  }

  return {
    hurtbox,
    animator,
    audio,
    clip,
    frame: (dt: number): void => {
      hurtbox.onUpdate(dt);
      script.onUpdate();
    },
  };
}

describe("HurtReactionScript", () => {
  it("reacts to nothing while the hurtbox is never hit", () => {
    const rig: Rig = createRig();

    for (let i: number = 0; i < 10; i++) {
      rig.frame(0.05);
    }

    expect(rig.animator.played).toEqual([]);
    expect(rig.audio.calls).toHaveLength(0);
  });

  it("plays the hurt clip and the hit sound on the frame following a hit", () => {
    const rig: Rig = createRig();

    rig.hurtbox.takeHit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.audio.calls).toHaveLength(1);
    expect(rig.audio.calls[0].clip).toBe(rig.clip);
    expect(rig.audio.calls[0].params).toEqual({ pitch: 1, volume: 1 });
  });

  it("forwards the injected pitch and volume", () => {
    const rig: Rig = createRig({ hitPitch: 1.3, hitVolume: 0.6 });

    rig.hurtbox.takeHit();
    rig.frame(0.05);

    expect(rig.audio.calls[0].params).toEqual({ pitch: 1.3, volume: 0.6 });
  });

  it("holds the hurt clip for the whole invincibility window", () => {
    const rig: Rig = createRig();

    rig.hurtbox.takeHit();

    for (let i: number = 0; i < 7; i++) {
      rig.frame(0.05);
    }

    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.animator.playing).toBe("hurt");
    expect(rig.audio.calls).toHaveLength(1);
  });

  it("returns to the rest clip once the invincibility expires, without a second sound", () => {
    const rig: Rig = createRig();

    rig.hurtbox.takeHit();

    for (let i: number = 0; i < 9; i++) {
      rig.frame(0.05);
    }

    expect(rig.animator.played).toEqual(["hurt", "idle"]);
    expect(rig.animator.playing).toBe("idle");
    expect(rig.audio.calls).toHaveLength(1);
  });

  it("replays the hurt clip and the sound on a second hit", () => {
    const rig: Rig = createRig();

    rig.hurtbox.takeHit();

    for (let i: number = 0; i < 9; i++) {
      rig.frame(0.05);
    }

    rig.hurtbox.takeHit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["hurt", "idle", "hurt"]);
    expect(rig.audio.calls).toHaveLength(2);
  });

  it("still animates when no hit clip was provided", () => {
    const rig: Rig = createRig({ hitClip: undefined });

    rig.hurtbox.takeHit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.audio.calls).toHaveLength(0);
  });

  it("honours overridden clip names", () => {
    const rig: Rig = createRig({ hurtClip: "damage", restClip: "stand" });

    rig.hurtbox.takeHit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["damage"]);
  });
});
