import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";

import type { AudioClip } from "@atlasjs/audio";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";
import { HurtReactionScript } from "../../../../src/game/scripts/combat/HurtReactionScript";

class FakeAnimator {
  public readonly played: string[] = [];
  public paused: boolean = false;
  private current: string = "idle";

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

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

type SpawnCall = { position: Vec2; rotation: number };

type Rig = {
  hurtbox: HurtboxScript;
  spawns: SpawnCall[];
  animator: FakeAnimator;
  audio: FakeAudioApi;
  character: FakeCharacter;
  clip: AudioClip;
  hit: (knockback?: number, hitstop?: number) => void;
  /** Advances the hurtbox timer then the observer, as the runtime does. */
  frame: (dt: number) => void;
};

function createRig(overrides: Record<string, unknown> = {}): Rig {
  const script: HurtReactionScript = new HurtReactionScript();
  const hurtbox: HurtboxScript = new HurtboxScript();
  const animator: FakeAnimator = new FakeAnimator();
  const audio: FakeAudioApi = new FakeAudioApi();
  const character: FakeCharacter = new FakeCharacter();
  const spawns: SpawnCall[] = [];
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
  injected.hitPitchJitter = 0;
  injected.hitVolume = 1;

  // onCreate() needs a bound script context, so resolve its lookups here.
  injected.animator = animator;
  injected.transform = { worldPosition: new Vec2(7, -3) };
  injected.target = { id: 1 };
  injected.impactPrefab = { name: "impact" };
  injected.instantiate = (_prefab: unknown, props: SpawnCall): void => {
    spawns.push({ position: props.position, rotation: props.rotation });
  };
  injected.character = character;
  injected.audio = audio;
  injected.wasInvincible = false;

  for (const key of Object.keys(overrides)) {
    injected[key] = overrides[key];
  }

  return {
    hurtbox,
    spawns,
    animator,
    audio,
    character,
    clip,
    hit: (knockback: number = 200, hitstop: number = 0): void => {
      hurtbox.takeHit({ direction: new Vec2(1, 0), knockback, hitstop });
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

  it("freezes the victim on impact instead of pushing it straight away", () => {
    const rig: Rig = createRig();

    rig.hit(200, 0.1);
    rig.frame(0.02);

    expect(rig.animator.paused).toBe(true);
    expect(rig.character.moves).toHaveLength(0);
    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.audio.calls).toHaveLength(1);
  });

  it("launches the victim at full speed once the freeze ends", () => {
    const rig: Rig = createRig();

    rig.hit(200, 0.1);

    for (let i: number = 0; i < 4; i++) {
      rig.frame(0.02);
    }

    expect(rig.animator.paused).toBe(true);
    expect(rig.character.moves).toHaveLength(0);

    rig.frame(0.02);

    expect(rig.animator.paused).toBe(false);
    expect(rig.character.moves).toHaveLength(1);
    // Undamped during the freeze, so the first step carries the full speed.
    expect(rig.character.moves[0].x).toBeCloseTo(200 * 0.02);
  });

  it("does not freeze when the weapon asked for no hitstop", () => {
    const rig: Rig = createRig();

    rig.hit(200, 0);
    rig.frame(0.02);

    expect(rig.animator.paused).toBe(false);
    expect(rig.character.moves).toHaveLength(1);
  });

  it("varies the pitch from hit to hit so chains stop sounding mechanical", () => {
    const rig: Rig = createRig({ hitPitchJitter: 0.08 });
    const pitches: Set<number> = new Set<number>();

    for (let i: number = 0; i < 20; i++) {
      rig.hit();
      rig.frame(0.01);
      rig.frame(0.5);
    }

    for (const call of rig.audio.calls) {
      const pitch: number = call.params?.pitch ?? 0;
      pitches.add(pitch);
      expect(pitch).toBeGreaterThanOrEqual(1 - 0.08);
      expect(pitch).toBeLessThanOrEqual(1 + 0.08);
    }

    expect(rig.audio.calls.length).toBeGreaterThan(1);
    expect(pitches.size).toBeGreaterThan(1);
  });

  it("never drops the pitch to zero or below, whatever the jitter", () => {
    const rig: Rig = createRig({ hitPitch: 0.02, hitPitchJitter: 5 });

    for (let i: number = 0; i < 20; i++) {
      rig.hit();
      rig.frame(0.01);
      rig.frame(0.5);
    }

    expect(rig.audio.calls.length).toBeGreaterThan(1);

    for (const call of rig.audio.calls) {
      expect(call.params?.pitch ?? 0).toBeGreaterThan(0);
    }
  });

  it("bursts an impact at its own position, turned to face the blow", () => {
    const rig: Rig = createRig();

    rig.hit();
    rig.frame(0.01);

    expect(rig.spawns).toHaveLength(1);
    expect(rig.spawns[0].position.x).toBeCloseTo(7);
    expect(rig.spawns[0].position.y).toBeCloseTo(-3);
    // The rig always strikes from the left, so the blow points along +x.
    expect(rig.spawns[0].rotation).toBeCloseTo(0);
  });

  it("bursts once per accepted hit, not once per frame", () => {
    const rig: Rig = createRig();

    rig.hit();

    for (let i: number = 0; i < 6; i++) {
      rig.frame(0.01);
    }

    expect(rig.spawns).toHaveLength(1);
  });

  it("reacts without a burst when no impact prefab was given", () => {
    const rig: Rig = createRig({ impactPrefab: undefined });

    rig.hit();
    rig.frame(0.01);

    expect(rig.spawns).toHaveLength(0);
    expect(rig.animator.played).toEqual(["hurt"]);
  });

  it("honours overridden clip names", () => {
    const rig: Rig = createRig({ hurtClip: "damage", restClip: "stand" });

    rig.hit();
    rig.frame(0.05);

    expect(rig.animator.played).toEqual(["damage"]);
  });
});
