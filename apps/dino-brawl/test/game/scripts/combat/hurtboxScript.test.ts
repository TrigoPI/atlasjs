import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";

/** The weapon side of a plain blow coming from the left. */
function hit(overrides: Record<string, unknown> = {}): {
  direction: Vec2;
  knockback?: number;
  hitstop?: number;
} {
  return { direction: new Vec2(1, 0), ...overrides };
}

function injectField(
  hurtbox: HurtboxScript,
  field: string,
  value: unknown,
): void {
  const injected: Record<string, unknown> = hurtbox as unknown as Record<
    string,
    unknown
  >;

  injected[field] = value;
}

describe("HurtboxScript", () => {
  it("is instantiable without an ECS world", () => {
    expect(() => new HurtboxScript()).not.toThrow();
  });

  it("counts no hit before it is struck", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    expect(hurtbox.hitCount).toBe(0);
    expect(hurtbox.isInvincible).toBe(false);
  });

  it("takes every blow by default, since weapons already limit themselves", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    expect(hurtbox.takeHit(hit())).toBe(true);
    expect(hurtbox.takeHit(hit())).toBe(true);
    expect(hurtbox.takeHit(hit())).toBe(true);
    expect(hurtbox.hitCount).toBe(3);
    expect(hurtbox.isInvincible).toBe(false);
  });

  it("carries the blow's knockback and hitstop", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit(hit({ knockback: 200, hitstop: 0.1 }));

    expect(hurtbox.hitKnockback).toBe(200);
    expect(hurtbox.hitHitstop).toBeCloseTo(0.1);
  });

  it("stores the hit direction as a unit vector", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit({ direction: new Vec2(0, -8) });

    expect(hurtbox.hitDirection.x).toBeCloseTo(0);
    expect(hurtbox.hitDirection.y).toBeCloseTo(-1);
  });

  it("survives a zero-length direction instead of producing NaN", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    expect(hurtbox.takeHit({ direction: new Vec2(0, 0) })).toBe(true);
    expect(Number.isNaN(hurtbox.hitDirection.x)).toBe(false);
  });

  it("reports no knockback when the weapon did not ask for any", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit(hit());

    expect(hurtbox.hitKnockback).toBe(0);
    expect(hurtbox.hitHitstop).toBe(0);
  });

  describe("with an invincibility window configured", () => {
    function createArmoured(duration: number = 0.4): HurtboxScript {
      const hurtbox: HurtboxScript = new HurtboxScript();
      injectField(hurtbox, "invincibilityDuration", duration);
      return hurtbox;
    }

    it("becomes invincible on the first blow", () => {
      const hurtbox: HurtboxScript = createArmoured();

      expect(hurtbox.takeHit(hit())).toBe(true);
      expect(hurtbox.isInvincible).toBe(true);
    });

    it("shrugs off every blow received while still invincible", () => {
      const hurtbox: HurtboxScript = createArmoured();

      hurtbox.takeHit(hit());

      expect(hurtbox.takeHit(hit())).toBe(false);
      expect(hurtbox.takeHit(hit())).toBe(false);
      expect(hurtbox.hitCount).toBe(1);
    });

    it("still shrugs one off just before the window elapses", () => {
      const hurtbox: HurtboxScript = createArmoured();

      hurtbox.takeHit(hit());
      hurtbox.onUpdate(0.39);

      expect(hurtbox.takeHit(hit())).toBe(false);
    });

    it("takes a new blow once the window has elapsed", () => {
      const hurtbox: HurtboxScript = createArmoured();

      hurtbox.takeHit(hit());
      hurtbox.onUpdate(0.4);

      expect(hurtbox.isInvincible).toBe(false);
      expect(hurtbox.takeHit(hit())).toBe(true);
      expect(hurtbox.hitCount).toBe(2);
    });

    it("keeps the previous blow's data when one is shrugged off", () => {
      const hurtbox: HurtboxScript = createArmoured();

      hurtbox.takeHit({ direction: new Vec2(1, 0), knockback: 200 });
      hurtbox.takeHit({ direction: new Vec2(-1, 0), knockback: 999 });

      expect(hurtbox.hitDirection.x).toBeCloseTo(1);
      expect(hurtbox.hitKnockback).toBe(200);
    });

    it("does not drift below zero while idle", () => {
      const hurtbox: HurtboxScript = createArmoured();

      hurtbox.onUpdate(10);
      hurtbox.onUpdate(10);

      expect(hurtbox.takeHit(hit())).toBe(true);
      expect(hurtbox.isInvincible).toBe(true);
    });
  });

  describe("grantInvincibility", () => {
    it("shrugs off hits during a granted invincibility window", () => {
      const hurtbox: HurtboxScript = new HurtboxScript();

      hurtbox.grantInvincibility(0.3);

      expect(hurtbox.takeHit(hit())).toBe(false);
      expect(hurtbox.hitCount).toBe(0);
    });

    it("is invincible during a granted window and stops once onUpdate consumes it", () => {
      const hurtbox: HurtboxScript = new HurtboxScript();

      hurtbox.grantInvincibility(0.3);

      expect(hurtbox.isInvincible).toBe(true);

      hurtbox.onUpdate(0.3);

      expect(hurtbox.isInvincible).toBe(false);
    });

    it("extends an invincibility window shorter than the granted duration", () => {
      const hurtbox: HurtboxScript = new HurtboxScript();

      injectField(hurtbox, "invincibilityRemaining", 0.1);
      hurtbox.grantInvincibility(0.3);
      hurtbox.onUpdate(0.29);

      expect(hurtbox.isInvincible).toBe(true);
    });

    it("never shortens an invincibility window already longer than the granted duration", () => {
      const hurtbox: HurtboxScript = new HurtboxScript();

      injectField(hurtbox, "invincibilityRemaining", 0.4);
      hurtbox.grantInvincibility(0.1);
      hurtbox.onUpdate(0.39);

      expect(hurtbox.isInvincible).toBe(true);
    });

    it("does nothing when the granted duration is zero or negative", () => {
      const hurtbox: HurtboxScript = new HurtboxScript();

      hurtbox.grantInvincibility(0);
      expect(hurtbox.isInvincible).toBe(false);

      hurtbox.grantInvincibility(-1);
      expect(hurtbox.isInvincible).toBe(false);
    });

    it("does not make an already-invincible hurtbox vulnerable when granted a non-positive duration", () => {
      const hurtbox: HurtboxScript = new HurtboxScript();

      hurtbox.grantInvincibility(0.3);
      hurtbox.grantInvincibility(0);

      expect(hurtbox.isInvincible).toBe(true);
      expect(hurtbox.takeHit(hit())).toBe(false);
    });
  });
});
