import { describe, expect, it } from "vitest";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { WeaponAttack } from "../../../../../src/game/scripts/weapon/attacks/WeaponAttack";
import { AttackChain } from "../../../../../src/game/scripts/weapon/attacks/AttackChain";

function createPose(): AttackPose {
  return { angleOffset: 0, radiusScale: 0, scale: 0 };
}

class FakeAttack extends WeaponAttack {
  public beginCount: number = 0;
  public readonly sampleCalls: Array<{ t: number; out: AttackPose }> = [];
  private readonly fixedDuration: number;
  private readonly fixedImpactTime: number;

  public constructor(fixedDuration: number, fixedImpactTime?: number) {
    super();
    this.fixedDuration = fixedDuration;
    this.fixedImpactTime = fixedImpactTime ?? fixedDuration * 0.5;
  }

  public get duration(): number {
    return this.fixedDuration;
  }

  public get impactTime(): number {
    return this.fixedImpactTime;
  }

  public begin(): void {
    this.beginCount += 1;
  }

  public sample(t: number, out: AttackPose): void {
    this.sampleCalls.push({ t, out });
  }
}

function injectAttacks(
  chain: AttackChain,
  attacks: WeaponAttack[],
  resetDelay?: number,
): void {
  const injected: Record<string, unknown> = chain as unknown as Record<
    string,
    unknown
  >;

  injected.attacks = attacks;

  if (resetDelay !== undefined) {
    injected.resetDelay = resetDelay;
  }
}

describe("AttackChain", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new AttackChain()).not.toThrow();
  });

  it("selects the first attack on the first begin, then cycles through the chain in order", () => {
    const chain: AttackChain = new AttackChain();
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);
    const spin: FakeAttack = new FakeAttack(0.7);

    injectAttacks(chain, [thrust, swing, spin]);

    chain.begin();
    expect(chain.duration).toBeCloseTo(0.5);

    chain.begin();
    expect(chain.duration).toBeCloseTo(0.6);

    chain.begin();
    expect(chain.duration).toBeCloseTo(0.7);

    chain.begin();
    expect(chain.duration).toBeCloseTo(0.5);
  });

  it("calls begin on the newly selected step only", () => {
    const chain: AttackChain = new AttackChain();
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    injectAttacks(chain, [thrust, swing]);

    chain.begin();
    expect(thrust.beginCount).toBe(1);
    expect(swing.beginCount).toBe(0);

    chain.begin();
    expect(thrust.beginCount).toBe(1);
    expect(swing.beginCount).toBe(1);
  });

  it("delegates sample to the current step with the exact t and out", () => {
    const chain: AttackChain = new AttackChain();
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    injectAttacks(chain, [thrust, swing]);

    chain.begin();
    const pose: AttackPose = createPose();
    chain.sample(0.12, pose);

    expect(thrust.sampleCalls).toHaveLength(1);
    expect(thrust.sampleCalls[0].t).toBe(0.12);
    expect(thrust.sampleCalls[0].out).toBe(pose);
    expect(swing.sampleCalls).toHaveLength(0);

    chain.begin();
    chain.sample(0.2, pose);

    expect(swing.sampleCalls).toHaveLength(1);
    expect(swing.sampleCalls[0].t).toBe(0.2);
    expect(swing.sampleCalls[0].out).toBe(pose);
  });

  it("keeps advancing when elapsed time is just under the reset threshold", () => {
    const chain: AttackChain = new AttackChain();
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    injectAttacks(chain, [thrust, swing]);

    chain.begin();
    chain.onUpdate(0.5 + 0.5 - 1e-3);
    chain.begin();

    expect(chain.duration).toBeCloseTo(0.6);
  });

  it("resets to the first attack when elapsed time exceeds the reset threshold", () => {
    const chain: AttackChain = new AttackChain();
    const thrust: FakeAttack = new FakeAttack(0.5);
    const swing: FakeAttack = new FakeAttack(0.6);

    injectAttacks(chain, [thrust, swing]);

    chain.begin();
    chain.onUpdate(0.5 + 0.5 + 1e-3);
    chain.begin();

    expect(chain.duration).toBeCloseTo(0.5);
  });

  it("resets the elapsed clock on every begin, so a fast combo does not reset mid-chain", () => {
    const chain: AttackChain = new AttackChain();
    const thrust: FakeAttack = new FakeAttack(0.3);
    const swing: FakeAttack = new FakeAttack(0.3);
    const spin: FakeAttack = new FakeAttack(0.3);

    injectAttacks(chain, [thrust, swing, spin]);

    chain.begin();
    chain.onUpdate(0.7);
    chain.begin();
    expect(chain.duration).toBeCloseTo(0.3);

    chain.onUpdate(0.7);
    chain.begin();
    expect(chain.duration).toBeCloseTo(0.3);
  });

  it("lets an injected resetDelay override the 0.5 default", () => {
    const chain: AttackChain = new AttackChain();
    const thrust: FakeAttack = new FakeAttack(0.2);
    const swing: FakeAttack = new FakeAttack(0.3);

    injectAttacks(chain, [thrust, swing], 1.5);

    chain.begin();
    chain.onUpdate(0.2 + 1.5 - 1e-3);
    chain.begin();
    expect(chain.duration).toBeCloseTo(0.3);

    chain.onUpdate(0.3 + 1.5 + 1e-3);
    chain.begin();
    expect(chain.duration).toBeCloseTo(0.2);
  });

  it("is a no-op and reports zero duration when the attack list is empty", () => {
    const chain: AttackChain = new AttackChain();

    expect(chain.duration).toBe(0);
    expect(() => chain.begin()).not.toThrow();

    const pose: AttackPose = createPose();
    expect(() => chain.sample(0, pose)).not.toThrow();
  });

  it("impactTime delegates to the current step and changes when the step changes", () => {
    const chain: AttackChain = new AttackChain();
    const thrust: FakeAttack = new FakeAttack(0.5, 0.2);
    const swing: FakeAttack = new FakeAttack(0.6, 0.3);

    injectAttacks(chain, [thrust, swing]);

    chain.begin();
    expect(chain.impactTime).toBeCloseTo(0.2);

    chain.begin();
    expect(chain.impactTime).toBeCloseTo(0.3);
  });

  it("impactTime is 0 when the attack list is empty", () => {
    const chain: AttackChain = new AttackChain();
    expect(chain.impactTime).toBe(0);
  });
});
