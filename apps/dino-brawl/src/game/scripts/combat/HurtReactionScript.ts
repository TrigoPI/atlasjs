import type { AudioClip } from "@atlasjs/audio";

import {
  Animator,
  AtlasScript,
  AudioApi,
  registerScriptMetadata,
  ScriptMetadata,
  type GameEntity,
} from "@atlasjs/gameplay";

import { HurtboxScript } from "./HurtboxScript";

type HurtReactionScriptProps = {
  hurtbox: HurtboxScript;
  target: GameEntity;
  hurtClip?: string;
  restClip?: string;
  hitClip?: AudioClip;
  hitPitch?: number;
  hitVolume?: number;
};

export class HurtReactionScript extends AtlasScript<HurtReactionScriptProps> {
  private readonly hurtbox: HurtboxScript;
  private readonly target: GameEntity;
  private readonly hurtClip: string = "hurt";
  private readonly restClip: string = "idle";
  private readonly hitClip?: AudioClip;
  private readonly hitPitch: number = 1;
  private readonly hitVolume: number = 1;

  private animator: Animator;
  private audio?: AudioApi;
  private wasInvincible: boolean;

  public onCreate(): void {
    this.animator = this.target.requireComponent(Animator);
    this.audio = this.getService(AudioApi);
    this.wasInvincible = this.hurtbox.isInvincible;
  }

  public onUpdate(): void {
    const invincible: boolean = this.hurtbox.isInvincible;

    if (invincible === this.wasInvincible) {
      return;
    }

    this.wasInvincible = invincible;

    if (!invincible) {
      this.animator.play(this.restClip);
      return;
    }

    this.animator.play(this.hurtClip);
    this.playHitSound();
  }

  private playHitSound(): void {
    if (this.audio === undefined || this.hitClip === undefined) {
      return;
    }

    this.audio.playOneShot(this.hitClip, {
      pitch: this.hitPitch,
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
    hitVolume: ScriptMetadata.field(),
  },
});
