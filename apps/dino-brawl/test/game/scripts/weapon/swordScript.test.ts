import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { CameraApi, GameEntity, InputApi } from "@atlasjs/gameplay";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";
import { SwordScript } from "../../../../src/game/scripts/weapon/SwordScript";
import type { AttackPose } from "../../../../src/game/scripts/weapon/attacks/WeaponAttack";

const DT: number = 0.05;

type PlayOneShotCall = {
  clip: AudioClip;
  params: { pitch?: number; volume?: number } | undefined;
};

class FakeAudioApi {
  public readonly calls: PlayOneShotCall[] = [];

  public playOneShot(
    clip: AudioClip,
    params?: { pitch?: number; volume?: number },
  ): void {
    this.calls.push({ clip, params });
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

function createTarget(id: number, hurtbox?: HurtboxScript): GameEntity {
  return {
    id,
    getScript: (): HurtboxScript | undefined => hurtbox,
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
  audio: FakeAudioApi;
  clip: AudioClip;
  frame: () => void;
};

/**
 * Puts a SwordScript straight into its "attacking" state without an ECS world,
 * mirroring how the other weapon test files inject private fields.
 */
function createRig(targetInvincibility?: number): Rig {
  const sword: SwordScript = new SwordScript();
  const hitbox: FakeHitbox = new FakeHitbox();
  const audio: FakeAudioApi = new FakeAudioApi();
  const clip: AudioClip = {} as unknown as AudioClip;

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
  injected.hitClip = clip;
  injected.hitPitch = 1;
  injected.hitVolume = 1;

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

  injected.audio = audio;
  injected.state = "attacking";
  injected.buffered = false;
  injected.hitstopRemaining = 0;

  return {
    sword,
    hitbox,
    audio,
    clip,
    frame: (): void => sword.onUpdate(DT),
  };
}

describe("SwordScript impact resolution", () => {
  it("plays no impact sound while the hitbox stays empty for the whole swing", () => {
    const rig: Rig = createRig();

    for (let i: number = 0; i < 10; i++) {
      rig.frame();
    }

    expect(rig.audio.calls).toHaveLength(0);
  });

  it("plays the impact sound when a target enters the hitbox mid-swing, not only on the first frame", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = new HurtboxScript();

    rig.frame();
    rig.frame();
    rig.frame();
    expect(rig.audio.calls).toHaveLength(0);

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.frame();

    expect(rig.audio.calls).toHaveLength(1);
    expect(rig.audio.calls[0].clip).toBe(rig.clip);
    expect(hurtbox.isInvincible).toBe(true);
  });

  it("does not play the sound again while the same target stays inside its invincibility window", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = new HurtboxScript();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let i: number = 0; i < 6; i++) {
      rig.frame();
      hurtbox.onUpdate(DT);
    }

    expect(rig.audio.calls).toHaveLength(1);
  });

  it("plays the sound a second time once the target's invincibility has elapsed", () => {
    const rig: Rig = createRig();
    const hurtbox: HurtboxScript = new HurtboxScript();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);

    for (let i: number = 0; i < 12; i++) {
      rig.frame();
      hurtbox.onUpdate(DT);
    }

    expect(rig.audio.calls).toHaveLength(2);
  });

  it("hands its targetInvincibility override to the target's hurtbox", () => {
    const rig: Rig = createRig(0.1);
    const hurtbox: HurtboxScript = new HurtboxScript();

    rig.hitbox.setTargets([createTarget(1, hurtbox)]);
    rig.frame();

    hurtbox.onUpdate(0.1);

    expect(hurtbox.isInvincible).toBe(false);
  });

  it("ignores a target that carries no hurtbox", () => {
    const rig: Rig = createRig();

    rig.hitbox.setTargets([createTarget(1)]);

    for (let i: number = 0; i < 5; i++) {
      rig.frame();
    }

    expect(rig.audio.calls).toHaveLength(0);
  });

  it("hits every target present in the hitbox on the same frame", () => {
    const rig: Rig = createRig();
    const first: HurtboxScript = new HurtboxScript();
    const second: HurtboxScript = new HurtboxScript();

    rig.hitbox.setTargets([createTarget(1, first), createTarget(2, second)]);
    rig.frame();

    expect(first.isInvincible).toBe(true);
    expect(second.isInvincible).toBe(true);
    expect(rig.audio.calls).toHaveLength(1);
  });
});
