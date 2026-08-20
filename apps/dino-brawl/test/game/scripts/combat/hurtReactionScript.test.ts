import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";

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

class FakeCharacter {
  public readonly moves: Vec2[] = [];
  public readonly total: Vec2 = new Vec2();

  public move(delta: Vec2): Vec2 {
    this.moves.push(delta.clone());
    this.total.add(delta);
    return delta;
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
  character: FakeCharacter;
  clip: AudioClip;
  hit: (knockback?: number) => void;
  /** Advances the hurtbox timer then the observer, as the runtime does. */
  frame: (dt: number) => void;
};

function createRig(overrides: Record<string, unknown> = {}): Rig {
  const script: HurtReactionScript = new HurtReactionScript();
  const hurtbox: HurtboxScript = new HurtboxScript();
  const animator: FakeAnimator = new FakeAnimator();
  const audio: FakeAudioApi = new FakeAudioApi();
  const character: FakeCharacter = new FakeCharacter();
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

  // onCreate() needs a bound script context, so resolve its lookups here.
  injected.animator = animator;
  injected.character = character;
  injected.audio = audio;
  injected.wasInvincible = false;

  for (const key of Object.keys(overrides)) {
    injected[key] = overrides[key];
  }

  return {
    hurtbox,
    animator,
    audio,
    character,
    clip,
    hit: (knockback: number = 200): void => {
      hurtbox.takeHit({ direction: new Vec2(1, 0), knockback });
    },
    frame: (dt: number): void => {
      hurtbox.onUpdate(dt);
      script.onUpdate(dt);
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

    rig.hit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.audio.calls).toHaveLength(1);
    expect(rig.audio.calls[0].clip).toBe(rig.clip);
    expect(rig.audio.calls[0].params).toEqual({ pitch: 1, volume: 1 });
  });

  it("forwards the injected pitch and volume", () => {
    const rig: Rig = createRig({ hitPitch: 1.3, hitVolume: 0.6 });

    rig.hit();
    rig.frame(0.05);

    expect(rig.audio.calls[0].params).toEqual({ pitch: 1.3, volume: 0.6 });
  });

  it("holds the hurt clip for the whole invincibility window", () => {
    const rig: Rig = createRig();

    rig.hit();

    for (let i: number = 0; i < 7; i++) {
      rig.frame(0.05);
    }

    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.animator.playing).toBe("hurt");
    expect(rig.audio.calls).toHaveLength(1);
  });

  it("returns to the rest clip once the invincibility expires, without a second sound", () => {
    const rig: Rig = createRig();

    rig.hit();

    for (let i: number = 0; i < 9; i++) {
      rig.frame(0.05);
    }

    expect(rig.animator.played).toEqual(["hurt", "idle"]);
    expect(rig.animator.playing).toBe("idle");
    expect(rig.audio.calls).toHaveLength(1);
  });

  it("replays the hurt clip and the sound on a second hit", () => {
    const rig: Rig = createRig();

    rig.hit();

    for (let i: number = 0; i < 9; i++) {
      rig.frame(0.05);
    }

    rig.hit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["hurt", "idle", "hurt"]);
    expect(rig.audio.calls).toHaveLength(2);
  });

  it("still animates when no hit clip was provided", () => {
    const rig: Rig = createRig({ hitClip: undefined });

    rig.hit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.audio.calls).toHaveLength(0);
  });

  it("pushes the victim along the hit direction", () => {
    const rig: Rig = createRig();

    rig.hit(200);
    rig.frame(0.05);

    expect(rig.character.moves).toHaveLength(1);
    expect(rig.character.total.x).toBeGreaterThan(0);
    expect(rig.character.total.y).toBeCloseTo(0);
  });

  it("pushes the other way when the hit comes from the other side", () => {
    const rig: Rig = createRig();

    rig.hurtbox.takeHit({ direction: new Vec2(-1, 0), knockback: 200 });
    rig.frame(0.05);

    expect(rig.character.total.x).toBeLessThan(0);
  });

  it("decays the push until it stops on its own", () => {
    const rig: Rig = createRig();

    rig.hit(200);

    for (let i: number = 0; i < 40; i++) {
      rig.frame(0.02);
    }

    const moves: Vec2[] = rig.character.moves;
    expect(moves.length).toBeGreaterThan(1);
    expect(moves[0].mag()).toBeGreaterThan(moves[moves.length - 1].mag());

    const before: number = rig.character.moves.length;
    rig.frame(0.02);
    expect(rig.character.moves).toHaveLength(before);
  });

  it("does not push when the weapon asked for no knockback", () => {
    const rig: Rig = createRig();

    rig.hit(0);
    rig.frame(0.05);

    expect(rig.character.moves).toHaveLength(0);
    expect(rig.animator.played).toEqual(["hurt"]);
  });

  it("scales the push by the victim's knockbackScale", () => {
    const light: Rig = createRig();
    const heavy: Rig = createRig({ knockbackScale: 0.25 });

    light.hit(200);
    heavy.hit(200);
    light.frame(0.05);
    heavy.frame(0.05);

    expect(heavy.character.total.x).toBeLessThan(light.character.total.x);
  });

  it("animates and sounds even when the victim cannot be pushed", () => {
    const rig: Rig = createRig({ character: undefined });

    rig.hit(200);

    expect(() => rig.frame(0.05)).not.toThrow();
    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.audio.calls).toHaveLength(1);
  });

  it("honours overridden clip names", () => {
    const rig: Rig = createRig({ hurtClip: "damage", restClip: "stand" });

    rig.hit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["damage"]);
  });
});
