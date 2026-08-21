import { describe, expect, it } from "vitest";

import type { AudioClip } from "@atlasjs/audio";

import type { AttackPhase } from "../../../../../src/game/scripts/weapon/attacks/AttackTimeline";
import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/AttackPose";
import { TimelineAttack } from "../../../../../src/game/scripts/weapon/attacks/TimelineAttack";

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
  attack: TimelineAttack,
  field: string,
  value: unknown,
): void {
  const injected: Record<string, unknown> = attack as unknown as Record<
    string,
    unknown
  >;

  injected[field] = value;
}

/** Two cued phases then one bare phase, so cursor behaviour is observable. */
class CuedAttack extends TimelineAttack {
  protected buildPhases(): AttackPhase[] {
    return [
      {
        name: "first",
        duration: 0.1,
        cue: { sound: { pitch: 2 }, rearmHits: true },
      },
      { name: "second", duration: 0.1, cue: { sound: {} } },
      { name: "third", duration: 0.1 },
    ];
  }
}

class SilentAttack extends TimelineAttack {
  protected buildPhases(): AttackPhase[] {
    return [
      { name: "first", duration: 0.1, cue: { rearmHits: true } },
      { name: "second", duration: 0.1 },
    ];
  }
}

class BareAttack extends TimelineAttack {
  protected buildPhases(): AttackPhase[] {
    return [{ name: "only", duration: 0.1 }];
  }
}

/** A single boundary at t = 0.1 carrying both a sound cue and rearmHits. */
class DoubleCueAttack extends TimelineAttack {
  protected buildPhases(): AttackPhase[] {
    return [
      { name: "first", duration: 0.1 },
      { name: "second", duration: 0.1, cue: { sound: {}, rearmHits: true } },
      { name: "third", duration: 0.1 },
    ];
  }
}

/** Two distinct boundaries that both carry rearmHits. */
class DoubleRearmAttack extends TimelineAttack {
  protected buildPhases(): AttackPhase[] {
    return [
      { name: "first", duration: 0.1, cue: { rearmHits: true } },
      { name: "second", duration: 0.1, cue: { rearmHits: true } },
    ];
  }
}

class EmptyAttack extends TimelineAttack {
  protected buildPhases(): AttackPhase[] {
    return [];
  }
}

describe("TimelineAttack cue emission", () => {
  it("is instantiable and advanceable without an ECS world", () => {
    const attack: CuedAttack = new CuedAttack();

    expect(() => {
      attack.begin();
      attack.advance(0.05);
    }).not.toThrow();
  });

  it("fires the phase-0 cue on the first advance, not on begin", () => {
    const attack: CuedAttack = new CuedAttack();
    const audio: FakeAudioApi = new FakeAudioApi();
    const clip: AudioClip = createClip();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", clip);

    attack.begin();
    expect(audio.calls).toHaveLength(0);

    attack.advance(0.01);
    expect(audio.calls).toHaveLength(1);
    expect(audio.calls[0].params).toEqual({ pitch: 2, volume: 1 });
  });

  it("resolves a cue sound against the attack when the cue omits a field", () => {
    const attack: CuedAttack = new CuedAttack();
    const audio: FakeAudioApi = new FakeAudioApi();
    const clip: AudioClip = createClip();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", clip);
    injectField(attack, "pitch", 1.4);
    injectField(attack, "volume", 0.6);

    attack.begin();
    attack.advance(0.15);

    // phase "first" overrides the pitch, phase "second" inherits everything.
    expect(audio.calls).toHaveLength(2);
    expect(audio.calls[0].params).toEqual({ pitch: 2, volume: 0.6 });
    expect(audio.calls[1].clip).toBe(clip);
    expect(audio.calls[1].params).toEqual({ pitch: 1.4, volume: 0.6 });
  });

  it("never replays a cue already consumed", () => {
    const attack: CuedAttack = new CuedAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", createClip());

    attack.begin();
    attack.advance(0.05);
    attack.advance(0.06);
    attack.advance(0.07);

    expect(audio.calls).toHaveLength(1);
  });

  it("keeps the cursor monotonic so a regressing t cannot replay a cue", () => {
    const attack: DoubleCueAttack = new DoubleCueAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", createClip());

    attack.begin();
    attack.advance(0.05);
    attack.advance(0.15);

    expect(audio.calls).toHaveLength(1);
    expect(attack.rearmsHits).toBe(true);

    attack.advance(0.08);
    expect(attack.rearmsHits).toBe(false);

    attack.advance(0.12);

    expect(audio.calls).toHaveLength(1);
    expect(attack.rearmsHits).toBe(false);
  });

  it("fires the phase-0 cue on the first advance even without a preceding begin", () => {
    const attack: CuedAttack = new CuedAttack();
    const audio: FakeAudioApi = new FakeAudioApi();
    const clip: AudioClip = createClip();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", clip);

    attack.advance(0.01);

    expect(audio.calls).toHaveLength(1);
    expect(audio.calls[0].params).toEqual({ pitch: 2, volume: 1 });
  });

  it("leaves rearmsHits false when a sound-only cue is crossed alone", () => {
    const attack: CuedAttack = new CuedAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", createClip());

    attack.begin();
    attack.advance(0.05);
    expect(attack.rearmsHits).toBe(true);

    attack.advance(0.15);

    expect(audio.calls).toHaveLength(2);
    expect(attack.rearmsHits).toBe(false);
  });

  it("stays safe for an attack whose buildPhases returns no phases", () => {
    const attack: EmptyAttack = new EmptyAttack();
    const audio: FakeAudioApi = new FakeAudioApi();
    const pose: AttackPose = { angleOffset: 0, radiusScale: 0, scale: 0 };

    injectField(attack, "audio", audio);
    injectField(attack, "clip", createClip());

    expect(attack.duration).toBe(0);

    expect(() => {
      attack.begin();
      attack.advance(0.05);
      attack.sample(0, pose);
    }).not.toThrow();

    expect(audio.calls).toHaveLength(1);
  });

  it("replays the cues after a fresh begin", () => {
    const attack: CuedAttack = new CuedAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", createClip());

    attack.begin();
    attack.advance(0.05);
    expect(audio.calls).toHaveLength(1);

    attack.begin();
    attack.advance(0.05);
    expect(audio.calls).toHaveLength(2);
  });

  it("raises rearmsHits on the crossing frame and drops it on the next", () => {
    const attack: CuedAttack = new CuedAttack();

    attack.begin();
    expect(attack.rearmsHits).toBe(false);

    attack.advance(0.01);
    expect(attack.rearmsHits).toBe(true);

    attack.advance(0.02);
    expect(attack.rearmsHits).toBe(false);
  });

  it("collapses several rearm cues crossed in one frame into one flag", () => {
    const attack: CuedAttack = new CuedAttack();

    attack.begin();
    attack.advance(10);

    expect(attack.rearmsHits).toBe(true);
  });

  it("collapses two distinct rearm cues crossed in the same advance into a single boolean flag", () => {
    const attack: DoubleRearmAttack = new DoubleRearmAttack();

    attack.begin();
    attack.advance(0.2);

    expect(attack.rearmsHits).toBe(true);
    expect(typeof attack.rearmsHits).toBe("boolean");
  });

  it("stops auto-playing the clip on begin as soon as a sound cue exists", () => {
    const attack: CuedAttack = new CuedAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", createClip());

    attack.begin();

    expect(audio.calls).toHaveLength(0);
  });

  it("still auto-plays the clip on begin when the cues carry no sound", () => {
    const attack: SilentAttack = new SilentAttack();
    const audio: FakeAudioApi = new FakeAudioApi();
    const clip: AudioClip = createClip();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", clip);
    injectField(attack, "pitch", 1.1);

    attack.begin();

    expect(audio.calls).toHaveLength(1);
    expect(audio.calls[0].clip).toBe(clip);
    expect(audio.calls[0].params).toEqual({ pitch: 1.1, volume: 1 });
  });

  it("still auto-plays the clip on begin when there is no cue at all", () => {
    const attack: BareAttack = new BareAttack();
    const audio: FakeAudioApi = new FakeAudioApi();

    injectField(attack, "audio", audio);
    injectField(attack, "clip", createClip());

    attack.begin();

    expect(audio.calls).toHaveLength(1);
  });

  it("keeps rearmsHits false on an attack whose cues never rearm", () => {
    const attack: BareAttack = new BareAttack();

    attack.begin();
    attack.advance(10);

    expect(attack.rearmsHits).toBe(false);
  });
});
