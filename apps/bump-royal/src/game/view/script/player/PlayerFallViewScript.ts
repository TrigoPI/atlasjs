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

import { PlayerStatus } from "../../../sim";
import { NetView } from "../../NetView";

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
  private networkDriven: boolean;
  private fallCount: number;
  private respawnCount: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.status = this.requireComponent(PlayerStatus);
    this.audio = this.getService(AudioApi);
    this.networkDriven = this.hasComponent(NetView);

    this.baseScale.copyFrom(this.transform.scale);
    this.fallCount = this.status.fallCount;
    this.respawnCount = this.status.respawnCount;
  }

  /* Public entry points: offline the monotonic counters below drive them, online a replicated
     fall or respawn event does. */
  public playFall(): void {
    if (this.networkDriven) {
      this.status.fallElapsed = 0;
    }

    this.audio.playOneShot(this.fallAudio, {
      volume: randomRange(0.1, 0.2),
      pitch: randomRange(0.9, 1.1),
    });
  }

  public playRespawn(): void {
    if (this.networkDriven) {
      this.status.fallElapsed = 0;
    }

    this.transform.scale.copyFrom(this.baseScale);
  }

  public onUpdate(dt: number): void {
    if (this.status.fallCount !== this.fallCount) {
      this.fallCount = this.status.fallCount;
      this.playFall();
    }

    if (this.status.respawnCount !== this.respawnCount) {
      this.respawnCount = this.status.respawnCount;
      this.playRespawn();
    }

    if (!this.status.falling) {
      return;
    }

    /* fallElapsed is not on the wire: 350 ms of pure cosmetics, with the drift bounded by one
       snapshot interval, does not pay for a field. Only a network-driven view integrates it —
       offline the fixed lane owns the value and this would double it. */
    if (this.networkDriven) {
      this.status.fallElapsed = Math.min(
        this.status.fallElapsed + dt,
        this.fallDuration,
      );
    }

    const t: number = Math.min(this.status.fallElapsed / this.fallDuration, 1);
    this.transform.scale.copyFrom(this.baseScale).mult(1 - t);
  }
}

registerScriptMetadata(PlayerFallViewScript, {
  exposed: {
    fallDuration: ScriptMetadata.field({ required: true }),
    fallAudio: ScriptMetadata.field({ required: true }),
  },
});
