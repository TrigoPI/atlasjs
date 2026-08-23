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
  public lastHitstop: number = 0;

  public override takeHit(hit: HitInfo): boolean {
    const landed: boolean = super.takeHit(hit);

    if (landed) {
      this.lastDirectionX = hit.direction.x;
      this.lastKnockback = hit.knockback ?? 0;
      this.lastHitstop = hit.hitstop ?? 0;
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
  public rearm: boolean = false;
  public knockbackOverride: number | undefined = undefined;
  public hitstopOverride: number | undefined = undefined;
  public readonly advanceCalls: number[] = [];

  public get duration(): number {
    return 1;
  }

  public get rearmsHits(): boolean {
    return this.rearm;
  }

  public get impactKnockback(): number | undefined {
    return this.knockbackOverride;
  }

  public get impactHitstop(): number | undefined {
    return this.hitstopOverride;
  }

  public begin(): void {}

  public advance(t: number): void {
    this.advanceCalls.push(t);
  }

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

function createAnchor(): GameEntity {
  return {
    requireComponent: (): object => ({ worldPosition: Vec2.zero() }),
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
  /** Begins a fresh swing, as clicking again would. */
  swing: () => void;
  hitbox: FakeHitbox;
  shakes: ShakeCall[];
  frame: () => void;
};

/**
 * Puts a SwordScript straight into its "attacking" state without an ECS world,
 * mirroring how the other weapon test files inject private fields.
 */
function createRig(overrides: Record<string, unknown> = {}): Rig {
  const sword: SwordScript = new SwordScript();
  const hitbox: FakeHitbox = new FakeHitbox();
  const shakes: ShakeCall[] = [];

  const injected: Record<string, unknown> = sword as unknown as Record<
    string,
    unknown
  >;

  injected.playerAnchor = createAnchor();
  injected.radius = 40;
  injected.angleOffset = 0;
  injected.attack = new FakeAttack();
  injected.hitbox = hitbox;
  injected.hitstopDuration = 0.07;
  injected.aim = { angle: 0 };

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

  injected.trail = { emitting: false };

  for (const key of Object.keys(overrides)) {
    injected[key] = overrides[key];
  }

  injected.state = "attacking";
  injected.buffered = false;
  injected.hitstopRemaining = 0;

  return {
    sword,
    swing: (): void =>
      (sword as unknown as { startAttack: () => void }).startAttack(),
    hitbox,
    shakes,
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
  });

  it("lands exactly one blow per swing, however long contact lasts", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    // The target has no invincibility at all: only the swing limits itself.
    for (let i: number = 0; i < 30; i++) {
      rig.frame();
      hurtbox.onUpdate(DT);
    }

    expect(hurtbox.accepted).toBe(1);
  });

  it("lands one blow per swing, so a three-step combo deals three", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let swing: number = 0; swing < 3; swing++) {
      rig.swing();

      for (let i: number = 0; i < 6; i++) {
        rig.frame();
        hurtbox.onUpdate(DT);
      }
    }

    expect(hurtbox.accepted).toBe(3);
  });

  it("still respects a target that has its own invincibility", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    (hurtbox as unknown as Record<string, unknown>).invincibilityDuration = 10;

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let swing: number = 0; swing < 3; swing++) {
      rig.swing();

      for (let i: number = 0; i < 6; i++) {
        rig.frame();
        hurtbox.onUpdate(DT);
      }
    }

    // Three swings, but the target shrugs the last two off.
    expect(hurtbox.accepted).toBe(1);
  });

  it("only shakes the camera on the swing that actually connects", () => {
    const rig: Rig = createRig();
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let i: number = 0; i < 20; i++) {
      rig.frame();
      hurtbox.onUpdate(DT);
    }

    // One blow, one hitstop, one camera punch.
    expect(rig.shakes).toHaveLength(1);
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

  it("does not shake on a swing that connects with nothing", () => {
    const rig: Rig = createRig();

    for (let i: number = 0; i < 6; i++) {
      rig.frame();
    }

    expect(rig.shakes).toHaveLength(0);
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

describe("SwordScript hit-window rearming", () => {
  it("advances the attack with the swing clock every frame", () => {
    const attack: FakeAttack = new FakeAttack();
    const rig: Rig = createRig({ attack });

    rig.frame();
    rig.frame();

    expect(attack.advanceCalls).toHaveLength(2);
    expect(attack.advanceCalls[0]).toBeCloseTo(DT);
    expect(attack.advanceCalls[1]).toBeCloseTo(DT * 2);
  });

  it("hits the same target again once the attack signals a rearm", () => {
    const attack: FakeAttack = new FakeAttack();
    const rig: Rig = createRig({ attack });
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    rig.frame();
    expect(hurtbox.accepted).toBe(1);

    // Those two frames burn the 0.07 hitstop; no rearm, so no second blow.
    rig.frame();
    rig.frame();
    expect(hurtbox.accepted).toBe(1);

    attack.rearm = true;
    rig.frame();
    expect(hurtbox.accepted).toBe(2);

    // The second blow re-armed the hitstop: burn it off before checking, or
    // the early return would pass this assertion without ever reaching the
    // rearm gate.
    attack.rearm = false;
    rig.frame();
    rig.frame();
    rig.frame();
    expect(hurtbox.accepted).toBe(2);
  });

  it("still lands exactly one blow per swing when nothing ever rearms", () => {
    const rig: Rig = createRig({ attack: new FakeAttack() });
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let i: number = 0; i < 30; i++) {
      rig.frame();
      hurtbox.onUpdate(DT);
    }

    expect(hurtbox.accepted).toBe(1);
  });
});

describe("SwordScript per-attack impact override", () => {
  it("passes the attack knockback to the hurtbox instead of its own", () => {
    const attack: FakeAttack = new FakeAttack();
    attack.knockbackOverride = 2200;

    const rig: Rig = createRig({ attack, knockback: 500 });
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(hurtbox.lastKnockback).toBe(2200);
  });

  it("keeps its own knockback when the attack overrides nothing", () => {
    const rig: Rig = createRig({
      attack: new FakeAttack(),
      knockback: 500,
    });
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(hurtbox.lastKnockback).toBe(500);
  });

  it("freezes for the attack hitstop rather than its own", () => {
    const attack: FakeAttack = new FakeAttack();
    attack.hitstopOverride = 0.3;

    const rig: Rig = createRig({ attack, hitstopDuration: 0.07 });
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();
    const injected: Record<string, unknown> = rig.sword as unknown as Record<
      string,
      unknown
    >;

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(injected.hitstopRemaining).toBeCloseTo(0.3);
  });

  it("hands the attack hitstop to the victim, not only to the sword", () => {
    const attack: FakeAttack = new FakeAttack();
    attack.hitstopOverride = 0.3;

    const rig: Rig = createRig({ attack, hitstopDuration: 0.07 });
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(hurtbox.lastHitstop).toBe(0.3);
  });

  it("hands its own hitstop to the victim when the attack overrides nothing", () => {
    const rig: Rig = createRig({
      attack: new FakeAttack(),
      hitstopDuration: 0.07,
    });
    const hurtbox: RecordingHurtbox = new RecordingHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(hurtbox.lastHitstop).toBe(0.07);
  });
});

describe("SwordScript trail", () => {
  it("turns the trail on when the swing starts", () => {
    const trail: { emitting: boolean } = { emitting: false };
    const rig: Rig = createRig({ trail });

    rig.swing();

    expect(trail.emitting).toBe(true);
  });

  it("turns the trail off once the swing ends", () => {
    const trail: { emitting: boolean } = { emitting: true };
    const rig: Rig = createRig({ trail, attackDuration: DT });

    rig.frame();

    expect(trail.emitting).toBe(false);
  });
});
