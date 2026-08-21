/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { AudioClip } from "@atlasjs/audio";

import {
  AtlasScript,
  AudioApi,
  registerScriptMetadata,
  ScriptMetadata,
  type EntityBuilder,
} from "@atlasjs/gameplay";

import type { AttackPose } from "./AttackPose";

export type { AttackPose } from "./AttackPose";

export type WeaponAttackFactory = (entity: EntityBuilder) => WeaponAttack;

export type WeaponAttackAudioProps = {
  clip?: AudioClip;
  pitch?: number;
  volume?: number;
};

export abstract class WeaponAttack<
  TProps extends object = {},
> extends AtlasScript<TProps> {
  protected clip?: AudioClip;
  protected pitch: number = 1;
  protected volume: number = 1;

  private audio?: AudioApi;

  public abstract get duration(): number;
  public abstract sample(t: number, out: AttackPose): void;

  public get rearmsHits(): boolean {
    return false;
  }

  public onCreate(): void {
    this.audio = this.getService(AudioApi);
  }

  public begin(): void {
    if (!this.playsClipOnBegin()) {
      return;
    }

    this.playClip();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public advance(_t: number): void {}

  protected playsClipOnBegin(): boolean {
    return true;
  }

  protected playClip(clip?: AudioClip, pitch?: number, volume?: number): void {
    const resolvedClip: AudioClip | undefined = clip ?? this.clip;

    if (this.audio === undefined || resolvedClip === undefined) {
      return;
    }

    this.audio.playOneShot(resolvedClip, {
      pitch: pitch ?? this.pitch,
      volume: volume ?? this.volume,
    });
  }
}

registerScriptMetadata(WeaponAttack, {
  exposed: {
    clip: ScriptMetadata.field(),
    pitch: ScriptMetadata.field(),
    volume: ScriptMetadata.field(),
  },
});
