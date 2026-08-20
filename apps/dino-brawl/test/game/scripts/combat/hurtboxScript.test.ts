import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";

/** The weapon side of a plain hit coming from the right. */
function hit(overrides: Record<string, unknown> = {}): {
  direction: Vec2;
  knockback?: number;
  invincibilityDuration?: number;
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

  it("is not invincible before taking any hit", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    expect(hurtbox.isInvincible).toBe(false);
  });

  it("accepts a first hit and becomes invincible", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    expect(hurtbox.takeHit(hit())).toBe(true);
    expect(hurtbox.isInvincible).toBe(true);
  });

  it("rejects every hit received while still invincible", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit(hit());

    expect(hurtbox.takeHit(hit())).toBe(false);
    expect(hurtbox.takeHit(hit())).toBe(false);
  });

  it("accepts a new hit once the default invincibility window has elapsed", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit(hit());
    hurtbox.onUpdate(0.4);

    expect(hurtbox.isInvincible).toBe(false);
    expect(hurtbox.takeHit(hit())).toBe(true);
  });

  it("still rejects a hit just before the window elapses", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit(hit());
    hurtbox.onUpdate(0.39);

    expect(hurtbox.takeHit(hit())).toBe(false);
  });

  it("uses the injected invincibilityDuration as its default window", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    injectField(hurtbox, "invincibilityDuration", 1);

    hurtbox.takeHit(hit());
    hurtbox.onUpdate(0.5);
    expect(hurtbox.takeHit(hit())).toBe(false);

    hurtbox.onUpdate(0.5);
    expect(hurtbox.takeHit(hit())).toBe(true);
  });

  it("lets the weapon override the window for that hit only", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit(hit({ invincibilityDuration: 0.1 }));
    hurtbox.onUpdate(0.1);

    expect(hurtbox.takeHit(hit())).toBe(true);
  });

  it("stores the hit direction as a unit vector", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit({ direction: new Vec2(0, -8), knockback: 200 });

    expect(hurtbox.hitDirection.x).toBeCloseTo(0);
    expect(hurtbox.hitDirection.y).toBeCloseTo(-1);
    expect(hurtbox.hitKnockback).toBe(200);
  });

  it("survives a zero-length direction instead of producing NaN", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    expect(hurtbox.takeHit({ direction: new Vec2(0, 0) })).toBe(true);
    expect(Number.isNaN(hurtbox.hitDirection.x)).toBe(false);
    expect(Number.isNaN(hurtbox.hitDirection.y)).toBe(false);
  });

  it("reports no knockback when the weapon did not ask for any", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit(hit());

    expect(hurtbox.hitKnockback).toBe(0);
  });

  it("keeps the previous hit data when a hit is rejected", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit({ direction: new Vec2(1, 0), knockback: 200 });
    hurtbox.takeHit({ direction: new Vec2(-1, 0), knockback: 999 });

    expect(hurtbox.hitDirection.x).toBeCloseTo(1);
    expect(hurtbox.hitKnockback).toBe(200);
  });

  it("does not drift below zero while idle", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.onUpdate(10);
    hurtbox.onUpdate(10);

    expect(hurtbox.takeHit(hit())).toBe(true);
    expect(hurtbox.isInvincible).toBe(true);
  });
});
