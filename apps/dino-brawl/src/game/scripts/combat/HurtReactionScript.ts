import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { Unsubscribe } from "@atlasjs/core";

import {
  Animator,
  AtlasScript,
  AudioApi,
  CharacterController,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
  type Prefab,
} from "@atlasjs/gameplay";

import type { ImpactPrefabProps } from "../../prefabs";

import { HurtboxScript } from "./HurtboxScript";

const MIN_KNOCKBACK_SPEED: number = 1;

type HurtReactionScriptProps = {
  hurtbox: HurtboxScript;
  target: GameEntity;
  hurtClip?: string;
  restClip?: string;
  hitClip?: AudioClip;
  hitPitch?: number;
  hitVolume?: number;
  knockbackScale?: number;
  knockbackDamping?: number;
  impactPrefab?: Prefab<ImpactPrefabProps>;
};

export class HurtReactionScript extends AtlasScript<HurtReactionScriptProps> {
  private readonly hurtbox: HurtboxScript;
  private readonly target: GameEntity;
  private readonly hurtClip: string = "hurt";
  private readonly restClip: string = "idle";
  private readonly hitClip?: AudioClip;
  private readonly hitPitch: number = 1;
  private readonly hitPitchJitter: number = 0.08;
  private readonly hitVolume: number = 1;
  private readonly knockbackScale: number = 1;
  private readonly knockbackDamping: number = 12;
  private readonly impactPrefab?: Prefab<ImpactPrefabProps>;

  private readonly knockbackVelocity: Vec2 = new Vec2();
  private readonly knockbackDelta: Vec2 = new Vec2();

  private animator: Animator;
  private transform: Transform;
  private character?: CharacterController;
  private audio?: AudioApi;
  private unsubscribe: Unsubscribe;
  private lastHitCount: number = 0;
  private hitstopRemaining: number = 0;

  public onCreate(): void {
    this.animator = this.target.requireComponent(Animator);
    this.transform = this.requireComponent(Transform);
    this.character = this.target.getComponent(CharacterController);
    this.audio = this.getService(AudioApi);
    this.lastHitCount = this.hurtbox.hitCount;
    this.hitstopRemaining = 0;

    this.unsubscribe = this.animator.on("finished", (clip: string) =>
      this.onClipFinished(clip),
    );
  }

  public onDestroy(): void {
    this.unsubscribe();
  }

  public onUpdate(dt: number): void {
    if (this.hurtbox.hitCount !== this.lastHitCount) {
      this.lastHitCount = this.hurtbox.hitCount;
      this.onHit();
    }

    if (this.advanceHitstop(dt)) {
      return;
    }

    this.advanceKnockback(dt);
  }

  /** Holds the victim still on impact. Returns true while frozen. */
  private advanceHitstop(dt: number): boolean {
    if (this.hitstopRemaining <= 0) {
      return false;
    }

    this.hitstopRemaining -= dt;

    if (this.hitstopRemaining > 0) {
      return true;
    }

    this.animator.resume();
    return false;
  }

  /** The hurt clip does not loop, so its end is the cue to stand back up. */
  private onClipFinished(clip: string): void {
    if (clip === this.hurtClip) {
      this.animator.play(this.restClip);
    }
  }

  private onHit(): void {
    // Restarts even if the previous blow is still playing out.
    this.animator.play(this.hurtClip, true);
    this.playHitSound();
    this.spawnImpact();

    this.knockbackVelocity
      .copyFrom(this.hurtbox.hitDirection)
      .mult(this.hurtbox.hitKnockback * this.knockbackScale);

    this.hitstopRemaining = this.hurtbox.hitHitstop;

    if (this.hitstopRemaining > 0) {
      this.animator.pause();
    }
  }

  private advanceKnockback(dt: number): void {
    if (this.knockbackVelocity.mag() < MIN_KNOCKBACK_SPEED) {
      this.knockbackVelocity.set(0, 0);
      return;
    }

    if (this.character !== undefined) {
      this.knockbackDelta.copyFrom(this.knockbackVelocity).mult(dt);
      this.character.move(this.knockbackDelta);
    }

    this.knockbackVelocity.mult(Math.max(0, 1 - this.knockbackDamping * dt));
  }

  /** Bursts at the point of contact, turned to face the blow. */
  private spawnImpact(): void {
    if (this.impactPrefab === undefined) {
      return;
    }

    this.instantiate(this.impactPrefab, {
      position: this.transform.worldPosition.clone(),
      rotation: this.hurtbox.hitDirection.angle(),
      owner: this.target.id,
    });
  }

  private playHitSound(): void {
    if (this.audio === undefined || this.hitClip === undefined) {
      return;
    }

    const jitter: number = (Math.random() * 2 - 1) * this.hitPitchJitter;

    this.audio.playOneShot(this.hitClip, {
      pitch: Math.max(0.01, this.hitPitch + jitter),
      volume: this.hitVolume,
    });
  }
}

registerScriptMetadata(HurtReactionScript, {
  exposed: {
    hurtbox: ScriptMetadata.field({ required: true }),
    target: ScriptMetadata.entity({ required: true }),
    hurtClip: ScriptMetadata.field(),
    restClip: ScriptMetadata.field(),
    hitClip: ScriptMetadata.field(),
    hitPitch: ScriptMetadata.field(),
    hitPitchJitter: ScriptMetadata.field(),
    hitVolume: ScriptMetadata.field(),
    knockbackScale: ScriptMetadata.field(),
    knockbackDamping: ScriptMetadata.field(),
    impactPrefab: ScriptMetadata.field(),
  },
});
