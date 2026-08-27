import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";
import {
  type GameEntity,
  type TrailRenderer,
  CameraApi,
  InputApi,
  TimeApi,
  Transform,
} from "@atlasjs/gameplay";
import {
  createScriptHarness,
  type ScriptHarness,
  type ScriptHarnessOptions,
} from "@atlasjs/gameplay/testing";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";
import { SwordScript } from "../../../../src/game/scripts/weapon/SwordScript";
import type { SwordHitboxScript } from "../../../../src/game/scripts/weapon/SwordHitboxScript";
import type {
  AttackPose,
  WeaponAttack,
} from "../../../../src/game/scripts/weapon/attacks/WeaponAttack";

const DT: number = 0.05;

class FakeHitbox {
  private targets: GameEntity[] = [];

  public setTargets(targets: GameEntity[]): void {
    this.targets = targets;
  }

  public getTargets(): readonly GameEntity[] {
    return this.targets;
  }
}

class FakeTimeApi {
  public readonly freezes: { seconds: number; entities: unknown[] }[] = [];

  public frozen: boolean = false;

  public scaleOf(): number {
    return this.frozen ? 0 : 1;
  }

  public freeze(seconds: number, ...entities: unknown[]): void {
    this.freezes.push({ seconds, entities });
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

function createTarget(id: number, hurtbox?: HurtboxScript): GameEntity {
  return {
    id,
    getScript: (): HurtboxScript | undefined => hurtbox,
  } as unknown as GameEntity;
}

const mounted: WeakMap<
  HurtboxScript,
  ScriptHarness<HurtboxScript>
> = new WeakMap<HurtboxScript, ScriptHarness<HurtboxScript>>();

/** Mounts a hurtbox on the unit seam so its timers can be advanced. */
function mountHurtbox(
  options: ScriptHarnessOptions<HurtboxScript>,
): HurtboxScript {
  const harness: ScriptHarness<HurtboxScript> = createScriptHarness(
    HurtboxScript,
    options,
  );

  harness.create();
  mounted.set(harness.script, harness);

  return harness.script;
}

/** Runs the hurtbox's own timers, as the script runtime would. */
function advanceHurtbox(hurtbox: HurtboxScript, dt: number): void {
  const harness: ScriptHarness<HurtboxScript> | undefined =
    mounted.get(hurtbox);

  if (harness === undefined) {
    throw new Error("This hurtbox was not mounted by mountHurtbox.");
  }

  harness.advance(dt);
}

function createInvincibleHurtbox(duration: number): HurtboxScript {
  return mountHurtbox({ props: { invincibilityDuration: duration } });
}

function createHurtbox(entityId?: number): HurtboxScript {
  return mountHurtbox({
    entityId: entityId === undefined ? undefined : (entityId as Entity),
  });
}

type ShakeCall = { strength: number; x: number; y: number };

type ShakeSpecLike = { strength: number };

function createAnchor(): GameEntity {
  return {
    requireComponent: (): object => ({ worldPosition: Vec2.zero() }),
    getScript: (): object => ({ angle: 0 }),
  } as unknown as GameEntity;
}

type TransformLike = {
  position: Vec2;
  scale: Vec2;
  rotation: number;
  worldPosition: Vec2;
  setScale: (x: number, y: number) => void;
};

function createTransform(): TransformLike {
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
  /** Drops the sword back to its idle state without ending the swing. */
  goIdle: () => void;
  hitbox: FakeHitbox;
  shakes: ShakeCall[];
  time: FakeTimeApi;
  frame: () => void;
  frames: (count: number) => void;
};

/**
 * Mounts a SwordScript on the unit seam so its own timers are advanced, then
 * puts it straight into its "attacking" state.
 */
function createRig(overrides: Record<string, unknown> = {}): Rig {
  const hitbox: FakeHitbox = new FakeHitbox();
  const shakes: ShakeCall[] = [];
  const time: FakeTimeApi = new FakeTimeApi();
  const anchor: GameEntity = createAnchor();

  const input: InputApi = {
    mousePosition: new Vec2(0, 0),
    isPressed: (): boolean => false,
  } as unknown as InputApi;

  const camera: CameraApi = {
    screenToWorld: (): Vec2 => new Vec2(100, 0),
    shake: (spec: ShakeSpecLike, direction: Vec2): void => {
      shakes.push({ strength: spec.strength, x: direction.x, y: direction.y });
    },
  } as unknown as CameraApi;

  const harness: ScriptHarness<SwordScript> = createScriptHarness(SwordScript, {
    props: {
      playerAnchor: 1 as Entity,
      radius: 40,
      angleOffset: 0,
      attack: new FakeAttack() as unknown as WeaponAttack,
      hitbox: hitbox as unknown as SwordHitboxScript,
      trail: { emitting: false } as unknown as TrailRenderer,
      hitstopDuration: 0.07,
    },
    components: [[Transform, createTransform()]],
    services: [
      [InputApi, input],
      [CameraApi, camera],
      [TimeApi, time],
    ],
    wrapEntity: (): GameEntity => anchor,
  });

  const sword: SwordScript = harness.script;

  harness.create();

  const injected: Record<string, unknown> = sword as unknown as Record<
    string,
    unknown
  >;

  injected.attackDuration = 1;

  for (const key of Object.keys(overrides)) {
    injected[key] = overrides[key];
  }

  injected.state = "attacking";
  injected.buffered = false;

  const frame = (): void => harness.advance(DT);

  return {
    sword,
    swing: (): void =>
      (sword as unknown as { startAttack: () => void }).startAttack(),
    goIdle: (): void => {
      injected.state = "idle";
    },
    hitbox,
    shakes,
    time,
    frame,
    frames: (count: number): void => {
      for (let i: number = 0; i < count; i++) {
        frame();
      }
    },
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
    const hurtbox: HurtboxScript = createHurtbox();

    rig.frame();
    rig.frame();
    rig.frame();
    expect(hurtbox.hitCount).toBe(0);

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.frame();

    expect(hurtbox.hitCount).toBe(1);
  });

  it("lands exactly one blow per swing, however long contact lasts", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    // The target has no invincibility at all: only the swing limits itself.
    for (let i: number = 0; i < 30; i++) {
      rig.frame();
      advanceHurtbox(hurtbox, DT);
    }

    expect(hurtbox.hitCount).toBe(1);
  });

  it("lands one blow per swing, so a three-step combo deals three", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let swing: number = 0; swing < 3; swing++) {
      rig.swing();

      for (let i: number = 0; i < 6; i++) {
        rig.frame();
        advanceHurtbox(hurtbox, DT);
      }
    }

    expect(hurtbox.hitCount).toBe(3);
  });

  it("still respects a target that has its own invincibility", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createInvincibleHurtbox(10);

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let swing: number = 0; swing < 3; swing++) {
      rig.swing();

      for (let i: number = 0; i < 6; i++) {
        rig.frame();
        advanceHurtbox(hurtbox, DT);
      }
    }

    // Three swings, but the target shrugs the last two off.
    expect(hurtbox.hitCount).toBe(1);
  });

  it("only shakes the camera on the swing that actually connects", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let i: number = 0; i < 20; i++) {
      rig.frame();
      advanceHurtbox(hurtbox, DT);
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
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.frame();

    // The rig aims at (100, 0) from the origin, so straight to the right.
    expect(hurtbox.hitDirection.x).toBeCloseTo(1);
    expect(hurtbox.hitKnockback).toBeGreaterThan(0);
  });

  it("punches the camera along the blow only when the blow lands", () => {
    const rig: Rig = createRig();

    rig.frame();
    rig.frame();
    expect(rig.shakes).toHaveLength(0);

    rig.hitbox.setTargets([createTarget(1, createHurtbox())]);
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
    const first: HurtboxScript = createHurtbox();
    const second: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, first), createTarget(2, second)]);
    rig.frame();

    expect(first.hitCount).toBe(1);
    expect(second.hitCount).toBe(1);
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

  it("restarts the swing clock on every new swing", () => {
    const attack: FakeAttack = new FakeAttack();
    const rig: Rig = createRig({ attack });

    rig.frames(3);
    rig.swing();
    rig.frame();

    expect(attack.advanceCalls).toHaveLength(4);
    expect(attack.advanceCalls[3]).toBeCloseTo(DT);
  });

  it("hits the same target again once the attack signals a rearm", () => {
    const attack: FakeAttack = new FakeAttack();
    const rig: Rig = createRig({ attack });
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    rig.frame();
    expect(hurtbox.hitCount).toBe(1);

    // Those two frames burn the 0.07 hitstop; no rearm, so no second blow.
    rig.frame();
    rig.frame();
    expect(hurtbox.hitCount).toBe(1);

    attack.rearm = true;
    rig.frame();
    expect(hurtbox.hitCount).toBe(2);

    // The second blow re-armed the hitstop: burn it off before checking, or
    // the early return would pass this assertion without ever reaching the
    // rearm gate.
    attack.rearm = false;
    rig.frame();
    rig.frame();
    rig.frame();
    expect(hurtbox.hitCount).toBe(2);
  });

  it("still lands exactly one blow per swing when nothing ever rearms", () => {
    const rig: Rig = createRig({ attack: new FakeAttack() });
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let i: number = 0; i < 30; i++) {
      rig.frame();
      advanceHurtbox(hurtbox, DT);
    }

    expect(hurtbox.hitCount).toBe(1);
  });
});

describe("SwordScript per-attack impact override", () => {
  it("passes the attack knockback to the hurtbox instead of its own", () => {
    const attack: FakeAttack = new FakeAttack();
    attack.knockbackOverride = 2200;

    const rig: Rig = createRig({ attack, knockback: 500 });
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(hurtbox.hitKnockback).toBe(2200);
  });

  it("keeps its own knockback when the attack overrides nothing", () => {
    const rig: Rig = createRig({
      attack: new FakeAttack(),
      knockback: 500,
    });
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(hurtbox.hitKnockback).toBe(500);
  });

  it("freezes for the attack hitstop rather than its own", () => {
    const attack: FakeAttack = new FakeAttack();
    attack.hitstopOverride = 0.3;

    const rig: Rig = createRig({ attack, hitstopDuration: 0.07 });
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(rig.time.freezes).toHaveLength(1);
    expect(rig.time.freezes[0].seconds).toBeCloseTo(0.3);
  });

  it("hands the attack hitstop to the victim, not only to the sword", () => {
    const attack: FakeAttack = new FakeAttack();
    attack.hitstopOverride = 0.3;

    const rig: Rig = createRig({ attack, hitstopDuration: 0.07 });
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(hurtbox.hitHitstop).toBe(0.3);
  });

  it("hands its own hitstop to the victim when the attack overrides nothing", () => {
    const rig: Rig = createRig({
      attack: new FakeAttack(),
      hitstopDuration: 0.07,
    });
    const hurtbox: HurtboxScript = createHurtbox();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.swing();
    rig.frame();

    expect(hurtbox.hitHitstop).toBe(0.07);
  });
});

describe("SwordScript hitstop", () => {
  it("freezes the attacker and its victim in the same call", () => {
    const rig: Rig = createRig();

    (rig.sword as unknown as { attack: FakeAttack }).attack.hitstopOverride =
      0.12;
    rig.hitbox.setTargets([createTarget(42, createHurtbox(42))]);

    rig.frame();

    expect(rig.time.freezes).toHaveLength(1);
    expect(rig.time.freezes[0].seconds).toBe(0.12);
    expect(rig.time.freezes[0].entities).toEqual([1, 42]);
  });

  it("freezes nothing when the attack declares no hitstop", () => {
    const rig: Rig = createRig({ hitstopDuration: 0 });

    rig.hitbox.setTargets([createTarget(42, createHurtbox(42))]);
    rig.frame();

    expect(rig.time.freezes).toHaveLength(0);
  });

  it("locks the pose to the memorized angle during the freeze", () => {
    const transform: TransformLike = createTransform();
    const rig: Rig = createRig({
      frozenAimAngle: Math.PI / 2,
      transform,
      aim: { angle: 0 },
    });
    const attack: FakeAttack = (rig.sword as unknown as { attack: FakeAttack })
      .attack;

    rig.time.frozen = true;
    const before: number = attack.advanceCalls.length;

    rig.frame();

    expect(attack.advanceCalls.length).toBe(before);
    expect(transform.rotation).toBeCloseTo(Math.PI / 2 + Math.PI / 4, 10);
  });
});

describe("SwordScript idle bob", () => {
  it("bobs the idle sword on its own clock, not on the swing clock", () => {
    const transform: TransformLike = createTransform();
    const rig: Rig = createRig({ transform });

    rig.frames(4);
    rig.swing();
    rig.goIdle();
    rig.frame();

    const w: number = 2 * Math.PI * 0.7;

    expect(transform.position.y).toBeCloseTo(Math.sin(w * (5 * DT)) * 8, 10);
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
