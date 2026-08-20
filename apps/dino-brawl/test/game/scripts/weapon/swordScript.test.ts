import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { CameraApi, GameEntity, InputApi } from "@atlasjs/gameplay";

import {
  type HitInfo,
  HurtboxScript,
} from "../../../../src/game/scripts/combat/HurtboxScript";
import { SwordScript } from "../../../../src/game/scripts/weapon/SwordScript";
import type { AttackPose } from "../../../../src/game/scripts/weapon/attacks/WeaponAttack";

const DT: number = 0.05;

/** A real hurtbox that records which hits it accepted. */
class RecordingHurtbox extends HurtboxScript {
  public accepted: number = 0;
  public lastDirectionX: number = 0;
  public lastKnockback: number = 0;

  public override takeHit(hit: HitInfo): boolean {
    const landed: boolean = super.takeHit(hit);

    if (landed) {
      this.lastDirectionX = hit.direction.x;
      this.lastKnockback = hit.knockback ?? 0;
    }

    if (landed) {
      this.accepted += 1;
    }

    return landed;
  }
}

class FakeHitbox {
  private targets: GameEntity[] = [];

  public setTargets(targets: GameEntity[]): void {
    this.targets = targets;
  }

  public getTargets(): readonly GameEntity[] {
    return this.targets;
  }
}

class FakeAttack {
  public get duration(): number {
    return 1;
  }

  public begin(): void {}

  public sample(_t: number, out: AttackPose): void {
    out.angleOffset = 0;
    out.radiusScale = 1;
    out.scale = 1;
  }
}

function createTarget(id: number, hurtbox?: RecordingHurtbox): GameEntity {
  return {
    id,
    getScript: (): RecordingHurtbox | undefined => hurtbox,
  } as unknown as GameEntity;
}

type ShakeCall = { strength: number; x: number; y: number };

type ShakeSpecLike = { strength: number };

class FakeOwner {
  public readonly moves: Vec2[] = [];

  public move(delta: Vec2): Vec2 {
    this.moves.push(delta.clone());
    return delta;
  }
}

/** The anchor the sword orbits: a child entity, with no controller on it. */
function createAnchor(): GameEntity {
  return {
    requireComponent: (): object => ({ worldPosition: Vec2.zero() }),
    getComponent: (): undefined => undefined,
  } as unknown as GameEntity;
}

/** The wielder, which is where the character controller actually lives. */
function createOwner(owner: FakeOwner): GameEntity {
  return {
    getComponent: (): FakeOwner => owner,
  } as unknown as GameEntity;
}

function createTransform(): object {
  return {
    position: new Vec2(0, 0),
    scale: new Vec2(1, 1),
    rotation: 0,
    worldPosition: Vec2.zero(),
    setScale: (): void => {},
  };
}

type Rig = {
  sword: SwordScript;
  hitbox: FakeHitbox;
  shakes: ShakeCall[];
  owner: FakeOwner;
  frame: () => void;
};

/**
 * Puts a SwordScript straight into its "attacking" state without an ECS world,
 * mirroring how the other weapon test files inject private fields.
 */
function createRig(
  targetInvincibility?: number,
  overrides: Record<string, unknown> = {},
): Rig {
  const sword: SwordScript = new SwordScript();
  const hitbox: FakeHitbox = new FakeHitbox();
  const shakes: ShakeCall[] = [];
  const owner: FakeOwner = new FakeOwner();

  const injected: Record<string, unknown> = sword as unknown as Record<
    string,
    unknown
  >;

  injected.playerAnchor = createAnchor();
  injected.owner = createOwner(owner);
  injected.radius = 40;
  injected.angleOffset = 0;
  injected.attack = new FakeAttack();
  injected.hitbox = hitbox;
  injected.hitstopDuration = 0.07;
  injected.targetInvincibility = targetInvincibility;

  injected.transform = createTransform();
  injected.baseScale = new Vec2(1, 1);
  injected.clock = 0;
  injected.offsetAmplitude = 8;
  injected.offsetFrequency = 0.7;
  injected.attackClock = 0;
  injected.attackDuration = 1;
  injected.swingDirection = 1;
  injected.frozenAimAngle = 0;

  injected.input = {
    mousePosition: new Vec2(0, 0),
    isPressed: (): boolean => false,
  } as unknown as InputApi;

  injected.camera = {
    screenToWorld: (): Vec2 => new Vec2(100, 0),
    shake: (spec: ShakeSpecLike, direction: Vec2): void => {
      shakes.push({ strength: spec.strength, x: direction.x, y: direction.y });
    },
  } as unknown as CameraApi;

  for (const key of Object.keys(overrides)) {
    injected[key] = overrides[key];
  }

  injected.state = "attacking";
  injected.buffered = false;
  injected.hitstopRemaining = 0;

  return {
    sword,
    hitbox,
    shakes,
    owner,
    frame: (): void => sword.onUpdate(DT),
  };
}

describe("SwordScript impact resolution", () => {
  it("lands no hit while the hitbox stays empty for the whole swing", () => {
    const rig: Rig = createRig();

    for (let i: number = 0; i < 10; i++) {
      rig.frame();
    }

    expect(rig.hitbox.getTargets()).toHaveLength(0);
  });

  it("hits a target that enters the hitbox mid-swing, not only on the first frame", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.frame();
    rig.frame();
    rig.frame();
    expect(hurtbox.accepted).toBe(0);

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.frame();

    expect(hurtbox.accepted).toBe(1);
    expect(hurtbox.isInvincible).toBe(true);
  });

  it("does not hit the same target again while it is still invincible", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let i: number = 0; i < 6; i++) {
      rig.frame();
      hurtbox.onUpdate(DT);
    }

    expect(hurtbox.accepted).toBe(1);
  });

  it("hits again once the target's invincibility has elapsed", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let i: number = 0; i < 12; i++) {
      rig.frame();
      hurtbox.onUpdate(DT);
    }

    expect(hurtbox.accepted).toBe(2);
  });

  it("hands its targetInvincibility override to the target's hurtbox", () => {
    const rig: Rig = createRig(0.1);
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.frame();

    hurtbox.onUpdate(0.1);

    expect(hurtbox.isInvincible).toBe(false);
  });

  it("ignores a target that carries no hurtbox", () => {
    const rig: Rig = createRig();

    rig.hitbox.setTargets([createTarget(1)]);

    expect(() => {
      for (let i: number = 0; i < 5; i++) {
        rig.frame();
      }
    }).not.toThrow();
  });

  it("describes the blow it deals: aim direction plus knockback", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.frame();

    // The rig aims at (100, 0) from the origin, so straight to the right.
    expect(hurtbox.lastDirectionX).toBeCloseTo(1);
    expect(hurtbox.lastKnockback).toBeGreaterThan(0);
  });

  it("punches the camera along the blow only when the blow lands", () => {
    const rig: Rig = createRig();

    rig.frame();
    rig.frame();
    expect(rig.shakes).toHaveLength(0);

    rig.hitbox.setTargets([createTarget(1, new RecordingHurtbox())]);
    rig.frame();

    expect(rig.shakes).toHaveLength(1);
    expect(rig.shakes[0].strength).toBeGreaterThan(0);
    expect(rig.shakes[0].x).toBeCloseTo(1);
  });

  it("shoves the wielder back, against the blow, once the freeze lifts", () => {
    const rig: Rig = createRig(undefined, { recoil: 140 });

    rig.hitbox.setTargets([createTarget(1, new RecordingHurtbox())]);

    // Held still on impact, like the victim.
    rig.frame();
    expect(rig.owner.moves).toHaveLength(0);

    for (let i: number = 0; i < 4; i++) {
      rig.frame();
    }

    expect(rig.owner.moves.length).toBeGreaterThan(0);
    expect(rig.owner.moves[0].x).toBeLessThan(0);
  });

  it("eases the wielder back rather than teleporting it", () => {
    const rig: Rig = createRig(undefined, { recoil: 140 });

    rig.hitbox.setTargets([createTarget(1, new RecordingHurtbox())]);

    for (let i: number = 0; i < 12; i++) {
      rig.frame();
    }

    const moves: Vec2[] = rig.owner.moves;

    // Spread over several frames, each shorter than the last.
    expect(moves.length).toBeGreaterThan(2);
    expect(moves[0].mag()).toBeGreaterThan(moves[moves.length - 1].mag());

    // And no step is the old one-frame jump of `recoil` units outright.
    for (const move of moves) {
      expect(move.mag()).toBeLessThan(20);
    }

    // The push settles around recoil / recoilDamping.
    const total: number = moves.reduce((sum, m) => sum + m.mag(), 0);
    expect(total).toBeGreaterThan(5);
    expect(total).toBeLessThan(15);
  });

  it("leaves the wielder alone when recoil is switched off", () => {
    const rig: Rig = createRig(undefined, { recoil: 0 });

    rig.hitbox.setTargets([createTarget(1, new RecordingHurtbox())]);

    for (let i: number = 0; i < 6; i++) {
      rig.frame();
    }

    expect(rig.owner.moves).toHaveLength(0);
  });

  it("looks for the controller on the wielder, not on the orbit anchor", () => {
    const rig: Rig = createRig(undefined, { recoil: 140 });

    rig.hitbox.setTargets([createTarget(1, new RecordingHurtbox())]);

    expect(() => {
      for (let i: number = 0; i < 5; i++) {
        rig.frame();
      }
    }).not.toThrow();

    expect(rig.owner.moves.length).toBeGreaterThan(0);
  });

  it("neither shakes nor recoils on a swing that connects with nothing", () => {
    const rig: Rig = createRig(undefined, { recoil: 140 });

    for (let i: number = 0; i < 6; i++) {
      rig.frame();
    }

    expect(rig.shakes).toHaveLength(0);
    expect(rig.owner.moves).toHaveLength(0);
  });

  it("hits every target present in the hitbox on the same frame", () => {
    const rig: Rig = createRig();
    const first: RecordingHurtbox = new RecordingHurtbox();
    const second: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, first), createTarget(2, second)]);
    rig.frame();

    expect(first.accepted).toBe(1);
    expect(second.accepted).toBe(1);
  });
});
