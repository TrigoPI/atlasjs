import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { GameEntity } from "@atlasjs/gameplay";

import {
  type HitInfo,
  HurtboxScript,
} from "../../../../src/game/scripts/combat/HurtboxScript";
import {
  type MeleeTargetSource,
  MeleeHitResolver,
} from "../../../../src/game/scripts/combat/MeleeHitResolver";

const KNOCKBACK: number = 220;
const HITSTOP: number = 0.07;
const DT: number = 0.05;

/** A real hurtbox that records which hits it accepted. */
class RecordingHurtbox extends HurtboxScript {
  public accepted: number = 0;
  public lastDirectionX: number = 0;
  public lastDirectionY: number = 0;
  public lastKnockback: number = 0;
  public lastHitstop: number = 0;

  public override takeHit(hit: HitInfo): boolean {
    const landed: boolean = super.takeHit(hit);

    if (landed) {
      this.lastDirectionX = hit.direction.x;
      this.lastDirectionY = hit.direction.y;
      this.lastKnockback = hit.knockback ?? 0;
      this.lastHitstop = hit.hitstop ?? 0;
      this.accepted += 1;
    }

    return landed;
  }
}

class FakeHitbox implements MeleeTargetSource {
  private targets: GameEntity[] = [];

  public setTargets(targets: GameEntity[]): void {
    this.targets = targets;
  }

  public getTargets(): readonly GameEntity[] {
    return this.targets;
  }
}

function createTarget(id: number, hurtbox?: RecordingHurtbox): GameEntity {
  return {
    id,
    getScript: (): RecordingHurtbox | undefined => hurtbox,
  } as unknown as GameEntity;
}

function createInvincibleHurtbox(duration: number): RecordingHurtbox {
  const hurtbox: RecordingHurtbox = new RecordingHurtbox();
  (hurtbox as unknown as Record<string, unknown>).invincibilityDuration =
    duration;
  return hurtbox;
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
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    expect(rig.resolve()).toBe(true);
    expect(hurtbox.accepted).toBe(1);
  });

  it("never strikes the same target twice within one swing", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    rig.resolve();

    for (let i: number = 0; i < 10; i++) {
      expect(rig.resolve()).toBe(false);
      hurtbox.onUpdate(DT);
    }

    expect(hurtbox.accepted).toBe(1);
  });

  it("re-arms on beginSwing, so the next swing lands again", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let swing: number = 0; swing < 3; swing++) {
      rig.resolver.beginSwing();

      expect(rig.resolve()).toBe(true);
      expect(rig.resolve()).toBe(false);
    }

    expect(hurtbox.accepted).toBe(3);
  });

  it("skips a target that carries no hurtbox", () => {
    const rig: Rig = createRig();

    rig.hitbox.setTargets([createTarget(1)]);

    expect(rig.resolve()).toBe(false);
  });

  it("does not record a target whose invincibility shrugged the blow off", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = createInvincibleHurtbox(10);

    hurtbox.takeHit({ direction: new Vec2(1, 0) });
    hurtbox.accepted = 0;

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    // Rejected while invincible: the swing must not count it as struck.
    expect(rig.resolve()).toBe(false);
    expect(hurtbox.accepted).toBe(0);

    hurtbox.onUpdate(20);

    // Same swing, no beginSwing: the blow it dodged still reaches it.
    expect(rig.resolve()).toBe(true);
    expect(hurtbox.accepted).toBe(1);
  });

  it("hits every target present on the same resolve", () => {
    const rig: Rig = createRig();
    const first: RecordingHurtbox = new RecordingHurtbox();
    const second: RecordingHurtbox = new RecordingHurtbox();
    const third: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([
      createTarget(1, first),
      createTarget(2, second),
      createTarget(3, third),
    ]);

    expect(rig.resolve()).toBe(true);
    expect(first.accepted).toBe(1);
    expect(second.accepted).toBe(1);
    expect(third.accepted).toBe(1);
  });

  it("describes the blow it deals: direction, knockback and hitstop", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.resolver.resolve(new Vec2(0, 1));

    expect(hurtbox.lastDirectionX).toBeCloseTo(0);
    expect(hurtbox.lastDirectionY).toBeCloseTo(1);
    expect(hurtbox.lastKnockback).toBe(KNOCKBACK);
    expect(hurtbox.lastHitstop).toBe(HITSTOP);
  });

  it("reports true only when at least one blow landed", () => {
    const rig: Rig = createRig();
    const struck: RecordingHurtbox = new RecordingHurtbox();
    const immune: RecordingHurtbox = createInvincibleHurtbox(10);

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

    rig.hitbox.setTargets([createTarget(1, new RecordingHurtbox())]);
    rig.resolver.resolve(direction);

    expect(direction.x).toBe(3);
    expect(direction.y).toBe(4);
  });
});
