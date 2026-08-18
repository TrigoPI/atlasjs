/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { AudioClip } from "@atlasjs/audio";

import {
  AtlasScript,
  AudioApi,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

export type AttackPose = {
  angleOffset: number;
  radiusScale: number;
  scale: number;
};

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
  public abstract get impactTime(): number;
  public abstract begin(): void;
  public abstract sample(t: number, out: AttackPose): void;

  public onCreate(): void {
    this.audio = this.getService(AudioApi);
  }

  protected playClip(): void {
    if (this.audio === undefined || this.clip === undefined) {
      return;
    }

    this.audio.playOneShot(this.clip, {
      pitch: this.pitch,
      volume: this.volume,
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
