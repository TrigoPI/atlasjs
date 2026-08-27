import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import {
  createScriptHarness,
  type ScriptHarness,
} from "@atlasjs/gameplay/testing";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";

/** The weapon side of a plain blow coming from the left. */
function hit(overrides: Record<string, unknown> = {}): {
  direction: Vec2;
  knockback?: number;
  hitstop?: number;
} {
  return { direction: new Vec2(1, 0), ...overrides };
}

function mount(
  invincibilityDuration: number = 0,
): ScriptHarness<HurtboxScript> {
  const harness: ScriptHarness<HurtboxScript> = createScriptHarness(
    HurtboxScript,
    { props: { invincibilityDuration } },
  );

  harness.create();

  return harness;
}

function createHurtbox(invincibilityDuration: number = 0): HurtboxScript {
  return mount(invincibilityDuration).script;
}

describe("HurtboxScript", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new HurtboxScript()).not.toThrow();
  });

  it("counts no hit before it is struck", () => {
    const hurtbox: HurtboxScript = createHurtbox();

    expect(hurtbox.hitCount).toBe(0);
    expect(hurtbox.isInvincible).toBe(false);
  });

  it("takes every blow by default, since weapons already limit themselves", () => {
    const hurtbox: HurtboxScript = createHurtbox();

    expect(hurtbox.takeHit(hit())).toBe(true);
    expect(hurtbox.takeHit(hit())).toBe(true);
    expect(hurtbox.takeHit(hit())).toBe(true);
    expect(hurtbox.hitCount).toBe(3);
    expect(hurtbox.isInvincible).toBe(false);
  });

  it("carries the blow's knockback and hitstop", () => {
    const hurtbox: HurtboxScript = createHurtbox();

    hurtbox.takeHit(hit({ knockback: 200, hitstop: 0.1 }));

    expect(hurtbox.hitKnockback).toBe(200);
    expect(hurtbox.hitHitstop).toBeCloseTo(0.1);
  });

  it("stores the hit direction as a unit vector", () => {
    const hurtbox: HurtboxScript = createHurtbox();

    hurtbox.takeHit({ direction: new Vec2(0, -8) });

    expect(hurtbox.hitDirection.x).toBeCloseTo(0);
    expect(hurtbox.hitDirection.y).toBeCloseTo(-1);
  });

  it("survives a zero-length direction instead of producing NaN", () => {
    const hurtbox: HurtboxScript = createHurtbox();

    expect(hurtbox.takeHit({ direction: new Vec2(0, 0) })).toBe(true);
    expect(Number.isNaN(hurtbox.hitDirection.x)).toBe(false);
  });

  it("reports no knockback when the weapon did not ask for any", () => {
    const hurtbox: HurtboxScript = createHurtbox();

    hurtbox.takeHit(hit());

    expect(hurtbox.hitKnockback).toBe(0);
    expect(hurtbox.hitHitstop).toBe(0);
  });

  describe("with an invincibility window configured", () => {
    function createArmoured(
      duration: number = 0.4,
    ): ScriptHarness<HurtboxScript> {
      return mount(duration);
    }

    it("becomes invincible on the first blow", () => {
      const hurtbox: HurtboxScript = createArmoured().script;

      expect(hurtbox.takeHit(hit())).toBe(true);
      expect(hurtbox.isInvincible).toBe(true);
    });

    it("shrugs off every blow received while still invincible", () => {
      const hurtbox: HurtboxScript = createArmoured().script;

      hurtbox.takeHit(hit());

      expect(hurtbox.takeHit(hit())).toBe(false);
      expect(hurtbox.takeHit(hit())).toBe(false);
      expect(hurtbox.hitCount).toBe(1);
    });

    it("still shrugs one off just before the window elapses", () => {
      const harness: ScriptHarness<HurtboxScript> = createArmoured();

      harness.script.takeHit(hit());
      harness.advance(0.39);

      expect(harness.script.takeHit(hit())).toBe(false);
    });

    it("takes a new blow once the window has elapsed", () => {
      const harness: ScriptHarness<HurtboxScript> = createArmoured();

      harness.script.takeHit(hit());
      harness.advance(0.4);

      expect(harness.script.isInvincible).toBe(false);
      expect(harness.script.takeHit(hit())).toBe(true);
      expect(harness.script.hitCount).toBe(2);
    });

    it("keeps the previous blow's data when one is shrugged off", () => {
      const hurtbox: HurtboxScript = createArmoured().script;

      hurtbox.takeHit({ direction: new Vec2(1, 0), knockback: 200 });
      hurtbox.takeHit({ direction: new Vec2(-1, 0), knockback: 999 });

      expect(hurtbox.hitDirection.x).toBeCloseTo(1);
      expect(hurtbox.hitKnockback).toBe(200);
    });

    it("does not drift below zero while idle", () => {
      const harness: ScriptHarness<HurtboxScript> = createArmoured();

      harness.advance(10);
      harness.advance(10);

      expect(harness.script.takeHit(hit())).toBe(true);
      expect(harness.script.isInvincible).toBe(true);
    });
  });

  describe("grantInvincibility", () => {
    it("shrugs off hits during a granted invincibility window", () => {
      const hurtbox: HurtboxScript = createHurtbox();

      hurtbox.grantInvincibility(0.3);

      expect(hurtbox.takeHit(hit())).toBe(false);
      expect(hurtbox.hitCount).toBe(0);
    });

    it("is invincible during a granted window and vulnerable again once it runs out", () => {
      const harness: ScriptHarness<HurtboxScript> = mount();

      harness.script.grantInvincibility(0.3);

      expect(harness.script.isInvincible).toBe(true);

      harness.advance(0.3);

      expect(harness.script.isInvincible).toBe(false);
    });

    it("extends an invincibility window shorter than the granted duration", () => {
      const harness: ScriptHarness<HurtboxScript> = mount();

      harness.script.grantInvincibility(0.1);
      harness.script.grantInvincibility(0.3);
      harness.advance(0.29);

      expect(harness.script.isInvincible).toBe(true);
    });

    it("never shortens an invincibility window already longer than the granted duration", () => {
      const harness: ScriptHarness<HurtboxScript> = mount();

      harness.script.grantInvincibility(0.4);
      harness.script.grantInvincibility(0.1);
      harness.advance(0.39);

      expect(harness.script.isInvincible).toBe(true);
    });

    it("does nothing when the granted duration is zero or negative", () => {
      const hurtbox: HurtboxScript = createHurtbox();

      hurtbox.grantInvincibility(0);
      expect(hurtbox.isInvincible).toBe(false);

      hurtbox.grantInvincibility(-1);
      expect(hurtbox.isInvincible).toBe(false);
    });

    it("does not make an already-invincible hurtbox vulnerable when granted a non-positive duration", () => {
      const hurtbox: HurtboxScript = createHurtbox();

      hurtbox.grantInvincibility(0.3);
      hurtbox.grantInvincibility(0);

      expect(hurtbox.isInvincible).toBe(true);
      expect(hurtbox.takeHit(hit())).toBe(false);
    });

    it("ignores a NaN duration instead of granting an endless window", () => {
      const harness: ScriptHarness<HurtboxScript> = mount();

      harness.script.grantInvincibility(Number.NaN);

      expect(harness.script.isInvincible).toBe(false);

      harness.script.grantInvincibility(0.3);
      harness.script.grantInvincibility(Number.NaN);

      expect(harness.script.isInvincible).toBe(true);

      harness.advance(0.3);

      expect(harness.script.isInvincible).toBe(false);
    });
  });
});
