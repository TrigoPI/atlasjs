import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";

import type { AudioClip } from "@atlasjs/audio";
import {
  createScriptHarness,
  type ScriptHarness,
} from "@atlasjs/gameplay/testing";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";
import { HurtReactionScript } from "../../../../src/game/scripts/combat/HurtReactionScript";

class FakeAnimator {
  public readonly played: string[] = [];
  public restarts: number = 0;
  private current: string = "idle";

  public play(name: string, restart: boolean = false): void {
    if (restart) {
      this.restarts += 1;
    }

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
  script: HurtReactionScript;
  hurtbox: HurtboxScript;
  spawns: SpawnCall[];
  animator: FakeAnimator;
  audio: FakeAudioApi;
  character: FakeCharacter;
  clip: AudioClip;
  hit: (knockback?: number) => void;
  /** Advances the hurtbox timer then the observer, as the runtime does. */
  frame: (dt: number) => void;
};

/** Fires the script's own "finished" handler, as the Animator would. */
function finishClip(rig: Rig, clip: string): void {
  (
    rig.script as unknown as { onClipFinished: (clip: string) => void }
  ).onClipFinished(clip);
}

function createRig(
  overrides: Record<string, unknown> = {},
  invincibilityDuration: number = 0,
): Rig {
  const script: HurtReactionScript = new HurtReactionScript();
  const hurtboxHarness: ScriptHarness<HurtboxScript> = createScriptHarness(
    HurtboxScript,
    { props: { invincibilityDuration } },
  );

  hurtboxHarness.create();

  const hurtbox: HurtboxScript = hurtboxHarness.script;
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
  injected.lastHitCount = 0;

  for (const key of Object.keys(overrides)) {
    injected[key] = overrides[key];
  }

  return {
    script,
    hurtbox,
    spawns,
    animator,
    audio,
    character,
    clip,
    hit: (knockback: number = 200): void => {
      hurtbox.takeHit({ direction: new Vec2(1, 0), knockback });
    },
    frame: (dt: number): void => {
      hurtboxHarness.advance(dt);
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

  it("keeps the hurt clip playing past the end of the invincibility window", () => {
    const rig: Rig = createRig({}, 0.4);

    rig.hit();

    for (let i: number = 0; i < 7; i++) {
      rig.frame(0.05);
    }

    expect(rig.hurtbox.isInvincible).toBe(true);
    expect(rig.animator.played).toEqual(["hurt"]);
    expect(rig.animator.playing).toBe("hurt");
    expect(rig.audio.calls).toHaveLength(1);

    rig.frame(0.1);

    expect(rig.hurtbox.isInvincible).toBe(false);
    expect(rig.animator.playing).toBe("hurt");
  });

  it("stands back up when the hurt clip ends, without a second sound", () => {
    const rig: Rig = createRig();

    rig.hit();
    rig.frame(0.05);

    finishClip(rig, "hurt");

    expect(rig.animator.played).toEqual(["hurt", "idle"]);
    expect(rig.animator.playing).toBe("idle");
    expect(rig.audio.calls).toHaveLength(1);
  });

  it("ignores another clip finishing", () => {
    const rig: Rig = createRig();

    rig.hit();
    rig.frame(0.05);

    finishClip(rig, "run");

    expect(rig.animator.playing).toBe("hurt");
  });

  it("reacts to every blow, back to back, with no window between them", () => {
    const rig: Rig = createRig();

    rig.hit();
    rig.frame(0.05);
    rig.hit();
    rig.frame(0.05);
    rig.hit();
    rig.frame(0.05);

    // Three blows, three sounds, three bursts: nothing is swallowed.
    expect(rig.audio.calls).toHaveLength(3);
    expect(rig.spawns).toHaveLength(3);
    expect(rig.animator.restarts).toBe(3);
  });

  it("reacts once per blow even if several frames pass", () => {
    const rig: Rig = createRig();

    rig.hit();

    for (let i: number = 0; i < 8; i++) {
      rig.frame(0.05);
    }

    expect(rig.audio.calls).toHaveLength(1);
    expect(rig.spawns).toHaveLength(1);
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

  it("does not advance the knockback on a zero dt", () => {
    const rig: Rig = createRig();

    rig.hit(100);
    rig.frame(0);

    expect(rig.character.moves.length).toBe(0);
  });

  it("resumes the knockback at full speed once the freeze lifts, moving exactly as far as if it had never frozen", () => {
    const frozen: Rig = createRig();
    const steady: Rig = createRig();

    frozen.hit(200);
    frozen.frame(0);
    frozen.frame(0);
    frozen.frame(0.02);

    steady.hit(200);
    steady.frame(0.02);

    expect(frozen.character.moves).toHaveLength(1);
    expect(steady.character.moves).toHaveLength(1);
    expect(frozen.character.moves[0].x).toBeCloseTo(
      steady.character.moves[0].x,
      10,
    );
    expect(frozen.character.moves[0].y).toBeCloseTo(
      steady.character.moves[0].y,
      10,
    );
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
