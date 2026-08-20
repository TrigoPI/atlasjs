import { describe, expect, it } from "vitest";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";

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

    expect(hurtbox.takeHit()).toBe(true);
    expect(hurtbox.isInvincible).toBe(true);
  });

  it("rejects every hit received while still invincible", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit();

    expect(hurtbox.takeHit()).toBe(false);
    expect(hurtbox.takeHit()).toBe(false);
  });

  it("accepts a new hit once the default invincibility window has elapsed", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit();
    hurtbox.onUpdate(0.4);

    expect(hurtbox.isInvincible).toBe(false);
    expect(hurtbox.takeHit()).toBe(true);
  });

  it("still rejects a hit just before the window elapses", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit();
    hurtbox.onUpdate(0.39);

    expect(hurtbox.takeHit()).toBe(false);
  });

  it("uses the injected invincibilityDuration as its default window", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    injectField(hurtbox, "invincibilityDuration", 1);

    hurtbox.takeHit();
    hurtbox.onUpdate(0.5);
    expect(hurtbox.takeHit()).toBe(false);

    hurtbox.onUpdate(0.5);
    expect(hurtbox.takeHit()).toBe(true);
  });

  it("lets the caller override the window for that hit only", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.takeHit(0.1);
    hurtbox.onUpdate(0.1);

    expect(hurtbox.takeHit()).toBe(true);
  });

  it("does not drift below zero while idle", () => {
    const hurtbox: HurtboxScript = new HurtboxScript();

    hurtbox.onUpdate(10);
    hurtbox.onUpdate(10);

    expect(hurtbox.takeHit()).toBe(true);
    expect(hurtbox.isInvincible).toBe(true);
  });
});
