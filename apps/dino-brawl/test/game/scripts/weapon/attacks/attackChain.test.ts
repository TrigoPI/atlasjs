import { describe, expect, it } from "vitest";

import type { AudioClip } from "@atlasjs/audio";
import { AudioApi } from "@atlasjs/gameplay";
import { createScriptHarness } from "@atlasjs/gameplay/testing";
import type { ScriptHarness } from "@atlasjs/gameplay/testing";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { WeaponAttack } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { AttackChain } from "../../../../../src/game/scripts/weapon/attacks/AttackChain";

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

class FakeAttack extends WeaponAttack {
  public beginCount: number = 0;
  public readonly sampleCalls: Array<{ t: number; out: AttackPose }> = [];
  public readonly advanceCalls: number[] = [];
  public rearm: boolean = false;
  private readonly fixedDuration: number;

  public constructor(fixedDuration: number) {
    super();
    this.fixedDuration = fixedDuration;
  }

  public get duration(): number {
    return this.fixedDuration;
  }

  public override get rearmsHits(): boolean {
    return this.rearm;
  }

  public begin(): void {
    this.beginCount += 1;
  }

  public override advance(t: number): void {
    this.advanceCalls.push(t);
  }

  public sample(t: number, out: AttackPose): void {
    this.sampleCalls.push({ t, out });
  }
}

type ChainRig = {
  chain: AttackChain;
  audio: FakeAudioApi;
  /** Runs one frame of the script runtime, timers first. */
  advance: (dt: number) => void;
};

/** Mounts a chain on the unit seam so its own stopwatch is advanced. */
function createChain(attacks: WeaponAttack[], resetDelay?: number): ChainRig {
  const audio: FakeAudioApi = new FakeAudioApi();

  const harness: ScriptHarness<AttackChain> = createScriptHarness(AttackChain, {
    props: resetDelay === undefined ? { attacks } : { attacks, resetDelay },
    services: [[AudioApi, audio]],
  });

  harness.create();

  return {
    chain: harness.script,
    audio,
    advance: (dt: number): void => harness.advance(dt),
  };
}

describe("AttackChain", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new AttackChain()).not.toThrow();
  });

  it("selects the first attack on the first begin, then cycles through the chain in order", () => {
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);
    const spin: FakeAttack = new FakeAttack(0.7);

    const rig: ChainRig = createChain([thrust, swing, spin]);

    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.5);

    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.6);

    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.7);

    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.5);
  });

  it("calls begin on the newly selected step only", () => {
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    const rig: ChainRig = createChain([thrust, swing]);

    rig.chain.begin();
    expect(thrust.beginCount).toBe(1);
    expect(swing.beginCount).toBe(0);

    rig.chain.begin();
    expect(thrust.beginCount).toBe(1);
    expect(swing.beginCount).toBe(1);
  });

  it("delegates sample to the current step with the exact t and out", () => {
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    const rig: ChainRig = createChain([thrust, swing]);

    rig.chain.begin();
    const pose: AttackPose = createPose();
    rig.chain.sample(0.12, pose);

    expect(thrust.sampleCalls).toHaveLength(1);
    expect(thrust.sampleCalls[0].t).toBe(0.12);
    expect(thrust.sampleCalls[0].out).toBe(pose);
    expect(swing.sampleCalls).toHaveLength(0);

    rig.chain.begin();
    rig.chain.sample(0.2, pose);

    expect(swing.sampleCalls).toHaveLength(1);
    expect(swing.sampleCalls[0].t).toBe(0.2);
    expect(swing.sampleCalls[0].out).toBe(pose);
  });

  it("keeps advancing when elapsed time is just under the reset threshold", () => {
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    const rig: ChainRig = createChain([thrust, swing]);

    rig.chain.begin();
    rig.advance(0.5 + 0.5 - 1e-3);
    rig.chain.begin();

    expect(rig.chain.duration).toBeCloseTo(0.6);
  });

  it("keeps advancing when elapsed time lands exactly on the reset threshold", () => {
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    const rig: ChainRig = createChain([thrust, swing]);

    rig.chain.begin();
    rig.advance(0.5 + 0.5);
    rig.chain.begin();

    expect(rig.chain.duration).toBeCloseTo(0.6);
  });

  it("resets to the first attack when elapsed time exceeds the reset threshold", () => {
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    const rig: ChainRig = createChain([thrust, swing]);

    rig.chain.begin();
    rig.advance(0.5 + 0.5 + 1e-3);
    rig.chain.begin();

    expect(rig.chain.duration).toBeCloseTo(0.5);
  });

  it("reads the elapsed clock before resetting it, so a late swing restarts the chain", () => {
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);
    const spin: FakeAttack = new FakeAttack(0.7);

    const rig: ChainRig = createChain([thrust, swing, spin]);

    rig.chain.begin();
    rig.advance(0.1);
    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.6);

    rig.advance(0.6 + 0.5 + 1e-3);
    rig.chain.begin();

    expect(rig.chain.duration).toBeCloseTo(0.5);
    expect(thrust.beginCount).toBe(2);
    expect(spin.beginCount).toBe(0);
  });

  it("resets the elapsed clock on every begin, so a fast combo does not reset mid-chain", () => {
    const thrust: FakeAttack = new FakeAttack(0.3);
    const swing: FakeAttack = new FakeAttack(0.3);
    const spin: FakeAttack = new FakeAttack(0.3);

    const rig: ChainRig = createChain([thrust, swing, spin]);

    rig.chain.begin();
    rig.advance(0.7);
    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.3);

    rig.advance(0.7);
    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.3);
  });

  it("lets an injected resetDelay override the 0.5 default", () => {
    const thrust: FakeAttack = new FakeAttack(0.2);
    const swing: FakeAttack = new FakeAttack(0.3);

    const rig: ChainRig = createChain([thrust, swing], 1.5);

    rig.chain.begin();
    rig.advance(0.2 + 1.5 - 1e-3);
    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.3);

    rig.advance(0.3 + 1.5 + 1e-3);
    rig.chain.begin();
    expect(rig.chain.duration).toBeCloseTo(0.2);
  });

  it("is a no-op and reports zero duration when the attack list is empty", () => {
    const rig: ChainRig = createChain([]);

    expect(rig.chain.duration).toBe(0);
    expect(() => rig.chain.begin()).not.toThrow();

    const pose: AttackPose = createPose();
    expect(() => rig.chain.sample(0, pose)).not.toThrow();
  });
});

describe("AttackChain cue forwarding", () => {
  it("forwards advance to the current attack only", () => {
    const first: FakeAttack = new FakeAttack(0.5);
    const second: FakeAttack = new FakeAttack(0.5);

    const rig: ChainRig = createChain([first, second]);

    rig.chain.begin();
    rig.chain.advance(0.3);

    expect(first.advanceCalls).toEqual([0.3]);
    expect(second.advanceCalls).toHaveLength(0);

    rig.chain.begin();
    rig.chain.advance(0.4);

    expect(first.advanceCalls).toEqual([0.3]);
    expect(second.advanceCalls).toEqual([0.4]);
  });

  it("forwards rearmsHits from the current attack", () => {
    const first: FakeAttack = new FakeAttack(0.5);
    const second: FakeAttack = new FakeAttack(0.5);

    const rig: ChainRig = createChain([first, second]);

    rig.chain.begin();
    expect(rig.chain.rearmsHits).toBe(false);

    first.rearm = true;
    expect(rig.chain.rearmsHits).toBe(true);

    rig.chain.begin();
    expect(rig.chain.rearmsHits).toBe(false);

    second.rearm = true;
    expect(rig.chain.rearmsHits).toBe(true);
  });

  it("is safe to advance an empty chain", () => {
    const rig: ChainRig = createChain([]);

    expect(() => rig.chain.advance(0.2)).not.toThrow();
    expect(rig.chain.rearmsHits).toBe(false);
  });
});
