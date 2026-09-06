import { Vec2 } from "@atlasjs/math";
import { randomRange } from "@atlasjs/utils";
import type { AudioClip } from "@atlasjs/audio";

import {
  AtlasScript,
  AudioApi,
  registerScriptMetadata,
  ScriptMetadata,
  Transform2D,
} from "@atlasjs/gameplay";

import { PlayerStatus } from "../../sim";

type PlayerFallViewScriptProps = {
  fallDuration: number;
  fallAudio: AudioClip;
};

export class PlayerFallViewScript extends AtlasScript<PlayerFallViewScriptProps> {
  private readonly fallDuration: number;
  private readonly fallAudio: AudioClip;

  private readonly baseScale: Vec2 = new Vec2();

  private transform: Transform2D;
  private status: PlayerStatus;
  private audio: AudioApi;
  private fallCount: number;
  private respawnCount: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.status = this.requireComponent(PlayerStatus);
    this.audio = this.getService(AudioApi);

    this.baseScale.copyFrom(this.transform.scale);
    this.fallCount = this.status.fallCount;
    this.respawnCount = this.status.respawnCount;
  }

  public onUpdate(): void {
    if (this.status.fallCount !== this.fallCount) {
      this.fallCount = this.status.fallCount;
      this.playFallAudio();
    }

    if (this.status.respawnCount !== this.respawnCount) {
      this.respawnCount = this.status.respawnCount;
      this.transform.scale.copyFrom(this.baseScale);
    }

    if (!this.status.falling) {
      return;
    }

    const t: number = Math.min(this.status.fallElapsed / this.fallDuration, 1);
    this.transform.scale.copyFrom(this.baseScale).mult(1 - t);
  }

  private playFallAudio(): void {
    this.audio.playOneShot(this.fallAudio, {
      volume: randomRange(0.1, 0.2),
      pitch: randomRange(0.9, 1.1),
    });
  }
}

registerScriptMetadata(PlayerFallViewScript, {
  exposed: {
    fallDuration: ScriptMetadata.field({ required: true }),
    fallAudio: ScriptMetadata.field({ required: true }),
  },
});
