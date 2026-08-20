import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { CameraApi, GameEntity, InputApi } from "@atlasjs/gameplay";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";
import { SwordScript } from "../../../../src/game/scripts/weapon/SwordScript";
import type { AttackPose } from "../../../../src/game/scripts/weapon/attacks/WeaponAttack";

const DT: number = 0.05;

/** A real hurtbox that records which hits it accepted. */
class RecordingHurtbox extends HurtboxScript {
  public accepted: number = 0;

  public override takeHit(invincibilityDuration?: number): boolean {
    const landed: boolean = super.takeHit(invincibilityDuration);

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
  hitbox: FakeHitbox;
  frame: () => void;
};

/**
 * Puts a SwordScript straight into its "attacking" state without an ECS world,
 * mirroring how the other weapon test files inject private fields.
 */
function createRig(targetInvincibility?: number): Rig {
  const sword: SwordScript = new SwordScript();
  const hitbox: FakeHitbox = new FakeHitbox();

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
  } as unknown as CameraApi;

  injected.state = "attacking";
  injected.buffered = false;
  injected.hitstopRemaining = 0;

  return {
    sword,
    hitbox,
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
