import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";
import type { GameEntity } from "@atlasjs/gameplay";
import {
  createScriptHarness,
  type ScriptHarness,
} from "@atlasjs/gameplay/testing";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";
import {
  type MeleeTargetSource,
  MeleeHitResolver,
} from "../../../../src/game/scripts/combat/MeleeHitResolver";

const KNOCKBACK: number = 220;
const HITSTOP: number = 0.07;
const DT: number = 0.05;

class FakeHitbox implements MeleeTargetSource {
  private targets: GameEntity[] = [];

  public setTargets(targets: GameEntity[]): void {
    this.targets = targets;
  }

  public getTargets(): readonly GameEntity[] {
    return this.targets;
  }
}

function createTarget(id: number, hurtbox?: HurtboxScript): GameEntity {
  return {
    id,
    getScript: (): HurtboxScript | undefined => hurtbox,
  } as unknown as GameEntity;
}

function createInvincibleHurtbox(duration: number): HurtboxScript {
  const harness: ScriptHarness<HurtboxScript> = createScriptHarness(
    HurtboxScript,
    { props: { invincibilityDuration: duration } },
  );

  return harness.script;
}

function createHurtbox(entityId?: number): HurtboxScript {
  return createScriptHarness(HurtboxScript, {
    entityId: entityId === undefined ? undefined : (entityId as Entity),
  }).script;
}

type Rig = {
  resolver: MeleeHitResolver;
  hitbox: FakeHitbox;
  /** Resolves a blow pointing straight to the right. */
  resolve: () => boolean;
};

function createRig(): Rig {
  const hitbox: FakeHitbox = new FakeHitbox();
  const resolver: MeleeHitResolver = new MeleeHitResolver(
    hitbox,
    KNOCKBACK,
    HITSTOP,
  );

  return {
    resolver,
    hitbox,
    resolve: (): boolean => resolver.resolve(new Vec2(1, 0)),
  };
}

describe("MeleeHitResolver", () => {
  it("lands nothing while the hitbox holds no target", () => {
    const rig: Rig = createRig();

    expect(rig.resolve()).toBe(false);
  });

  it("lands one blow on the single target it touches", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    expect(rig.resolve()).toBe(true);
    expect(hurtbox.hitCount).toBe(1);
  });

  it("never strikes the same target twice within one swing", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    rig.resolve();

    for (let i: number = 0; i < 10; i++) {
      expect(rig.resolve()).toBe(false);
      hurtbox.onUpdate(DT);
    }

    expect(hurtbox.hitCount).toBe(1);
  });

  it("re-arms on beginSwing, so the next swing lands again", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let swing: number = 0; swing < 3; swing++) {
      rig.resolver.beginSwing();

      expect(rig.resolve()).toBe(true);
      expect(rig.resolve()).toBe(false);
    }

    expect(hurtbox.hitCount).toBe(3);
  });

  it("skips a target that carries no hurtbox", () => {
    const rig: Rig = createRig();

    rig.hitbox.setTargets([createTarget(1)]);

    expect(rig.resolve()).toBe(false);
  });

  it("does not record a target whose invincibility shrugged the blow off", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createInvincibleHurtbox(10);

    hurtbox.takeHit({ direction: new Vec2(1, 0) });

    const primed: number = hurtbox.hitCount;

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    // Rejected while invincible: the swing must not count it as struck.
    expect(rig.resolve()).toBe(false);
    expect(hurtbox.hitCount).toBe(primed);

    hurtbox.onUpdate(20);

    // Same swing, no beginSwing: the blow it dodged still reaches it.
    expect(rig.resolve()).toBe(true);
    expect(hurtbox.hitCount).toBe(primed + 1);
  });

  it("hits every target present on the same resolve", () => {
    const rig: Rig = createRig();
    const first: HurtboxScript = createHurtbox();
    const second: HurtboxScript = createHurtbox();
    const third: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([
      createTarget(1, first),
      createTarget(2, second),
      createTarget(3, third),
    ]);

    expect(rig.resolve()).toBe(true);
    expect(first.hitCount).toBe(1);
    expect(second.hitCount).toBe(1);
    expect(third.hitCount).toBe(1);
  });

  it("describes the blow it deals: direction, knockback and hitstop", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.resolver.resolve(new Vec2(0, 1));

    expect(hurtbox.hitDirection.x).toBeCloseTo(0);
    expect(hurtbox.hitDirection.y).toBeCloseTo(1);
    expect(hurtbox.hitKnockback).toBe(KNOCKBACK);
    expect(hurtbox.hitHitstop).toBe(HITSTOP);
  });

  it("reports true only when at least one blow landed", () => {
    const rig: Rig = createRig();
    const struck: HurtboxScript = createHurtbox();
    const immune: HurtboxScript = createInvincibleHurtbox(10);

    immune.takeHit({ direction: new Vec2(1, 0) });

    rig.hitbox.setTargets([createTarget(1, immune), createTarget(2, struck)]);

    // One target refuses the blow, the other takes it.
    expect(rig.resolve()).toBe(true);

    rig.hitbox.setTargets([createTarget(1, immune)]);

    expect(rig.resolve()).toBe(false);
  });

  it("leaves the caller's direction vector untouched", () => {
    const rig: Rig = createRig();
    const direction: Vec2 = new Vec2(3, 4);

    rig.hitbox.setTargets([createTarget(1, createHurtbox())]);
    rig.resolver.resolve(direction);

    expect(direction.x).toBe(3);
    expect(direction.y).toBe(4);
  });
});

describe("MeleeHitResolver per-swing impact override", () => {
  it("uses the constructor values when beginSwing is called bare", () => {
    const hitbox: FakeHitbox = new FakeHitbox();
    const hurtbox: HurtboxScript = createHurtbox();
    const resolver: MeleeHitResolver = new MeleeHitResolver(
      hitbox,
      KNOCKBACK,
      HITSTOP,
    );

    hitbox.setTargets([createTarget(1, hurtbox)]);
    resolver.beginSwing();
    resolver.resolve(new Vec2(1, 0));

    expect(hurtbox.hitKnockback).toBe(KNOCKBACK);
    expect(hurtbox.hitHitstop).toBe(HITSTOP);
  });

  it("applies the values handed to beginSwing for that swing", () => {
    const hitbox: FakeHitbox = new FakeHitbox();
    const hurtbox: HurtboxScript = createHurtbox();
    const resolver: MeleeHitResolver = new MeleeHitResolver(
      hitbox,
      KNOCKBACK,
      HITSTOP,
    );

    hitbox.setTargets([createTarget(1, hurtbox)]);
    resolver.beginSwing(2200, 0.2);
    resolver.resolve(new Vec2(1, 0));

    expect(hurtbox.hitKnockback).toBe(2200);
    expect(hurtbox.hitHitstop).toBe(0.2);
  });

  it("falls back per field, not all-or-nothing", () => {
    const hitbox: FakeHitbox = new FakeHitbox();
    const hurtbox: HurtboxScript = createHurtbox();
    const resolver: MeleeHitResolver = new MeleeHitResolver(
      hitbox,
      KNOCKBACK,
      HITSTOP,
    );

    hitbox.setTargets([createTarget(1, hurtbox)]);
    resolver.beginSwing(2200, undefined);
    resolver.resolve(new Vec2(1, 0));

    expect(hurtbox.hitKnockback).toBe(2200);
    expect(hurtbox.hitHitstop).toBe(HITSTOP);
  });

  it("reverts to the constructor values on the next bare beginSwing", () => {
    const hitbox: FakeHitbox = new FakeHitbox();
    const hurtbox: HurtboxScript = createHurtbox();
    const resolver: MeleeHitResolver = new MeleeHitResolver(
      hitbox,
      KNOCKBACK,
      HITSTOP,
    );

    hitbox.setTargets([createTarget(1, hurtbox)]);

    resolver.beginSwing(2200, 0.2);
    resolver.resolve(new Vec2(1, 0));

    hurtbox.onUpdate(DT);
    resolver.beginSwing();
    resolver.resolve(new Vec2(1, 0));

    expect(hurtbox.hitKnockback).toBe(KNOCKBACK);
    expect(hurtbox.hitHitstop).toBe(HITSTOP);
  });

  // An explicit 0 is a legitimate authoring choice, so the fallback must be
  // nullish (??) and not truthiness (||), which would silently discard it.
  it("honours an explicit 0 instead of falling back to the default", () => {
    const hitbox: FakeHitbox = new FakeHitbox();
    const hurtbox: HurtboxScript = createHurtbox();
    const resolver: MeleeHitResolver = new MeleeHitResolver(
      hitbox,
      KNOCKBACK,
      HITSTOP,
    );

    hitbox.setTargets([createTarget(1, hurtbox)]);
    resolver.beginSwing(0, 0);
    resolver.resolve(new Vec2(1, 0));

    expect(hurtbox.hitKnockback).toBe(0);
    expect(hurtbox.hitHitstop).toBe(0);
  });
});

describe("MeleeHitResolver.lastStruck", () => {
  it("lists the entities hit by the last resolve", () => {
    const rig: Rig = createRig();

    rig.hitbox.setTargets([
      createTarget(7, createHurtbox(7)),
      createTarget(9, createHurtbox(9)),
    ]);

    expect(rig.resolve()).toBe(true);
    expect([...rig.resolver.lastStruck]).toEqual([7, 9]);
  });

  it("empties when a resolve hits nothing", () => {
    const rig: Rig = createRig();

    rig.hitbox.setTargets([createTarget(7, createHurtbox(7))]);
    rig.resolve();
    rig.resolve();

    expect(rig.resolver.lastStruck.length).toBe(0);
  });

  it("does not count a target that dodged the hit", () => {
    const rig: Rig = createRig();
    const immune: HurtboxScript = createInvincibleHurtbox(10);

    immune.takeHit({ direction: new Vec2(1, 0) });
    rig.hitbox.setTargets([createTarget(7, immune)]);

    rig.resolve();

    expect(rig.resolver.lastStruck.length).toBe(0);
  });

  it("credits the hurtbox's owner, not the collider entity carrying it", () => {
    const rig: Rig = createRig();
    const childHurtbox: HurtboxScript = createScriptHarness(HurtboxScript, {
      entityId: 99 as Entity,
      props: { owner: 1 as Entity },
    }).script;

    rig.hitbox.setTargets([createTarget(99, childHurtbox)]);

    expect(rig.resolve()).toBe(true);
    expect([...rig.resolver.lastStruck]).toEqual([1]);
  });

  it("falls back to the collider's own entity when the hurtbox has no owner", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = new HurtboxScript();

    rig.hitbox.setTargets([createTarget(7, hurtbox)]);

    expect(rig.resolve()).toBe(true);
    expect([...rig.resolver.lastStruck]).toEqual([7]);
  });
});
