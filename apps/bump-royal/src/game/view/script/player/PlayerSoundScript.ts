import { MathUtils } from "@atlasjs/math";
import { randomRange } from "@atlasjs/utils";
import type { AudioClip } from "@atlasjs/audio";

import { impactSpeedBetween, reportsPair } from "../../../sim/impact";

import {
  type GameEntity,
  AtlasScript,
  AudioApi,
  registerScriptMetadata,
  RigidBody,
  ScriptMetadata,
  Tag,
  Transform2D,
} from "@atlasjs/gameplay";

type PlayerSoundScriptProps = {
  bumpAudio: AudioClip;
  maxImpactSpeed: number;
  minVolume: number;
  maxVolume: number;
  minPitch: number;
  maxPitch: number;
  pitchJitter: number;
};

export class PlayerSoundScript extends AtlasScript<PlayerSoundScriptProps> {
  private readonly bumpAudio: AudioClip;
  private readonly maxImpactSpeed: number;
  private readonly minVolume: number;
  private readonly maxVolume: number;
  private readonly minPitch: number;
  private readonly maxPitch: number;
  private readonly pitchJitter: number;

  private transform: Transform2D;
  private rigidBody: RigidBody | undefined;
  private audio: AudioApi;

  /* getComponent and not requireComponent: the online view prefab replicates its position and
     carries no body at all. Requiring one would throw inside onCreate, and ScriptManager
     answers that by disabling the script — silently, on every remote player. */
  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.rigidBody = this.getComponent(RigidBody);
    this.audio = this.getService(AudioApi);
  }

  /* Impact speed, not a raw volume: the same number the server computes with the same formula,
     so a bump sounds identical whichever side decided it happened. */
  public playBump(speed: number): void {
    const t: number = MathUtils.clamp(speed / this.maxImpactSpeed, 0, 1);
    const pitch: number = MathUtils.lerp(this.maxPitch, this.minPitch, t);
    const jitter: number = randomRange(-this.pitchJitter, this.pitchJitter);

    this.audio.playOneShot(this.bumpAudio, {
      volume: MathUtils.lerp(this.minVolume, this.maxVolume, t),
      pitch: Math.max(0.01, pitch + jitter),
    });
  }

  // prettier-ignore
  public onCollisionEnter(other: GameEntity): void {
    if (this.rigidBody === undefined) {
      return;
    }

    if (!other.hasComponent(Tag)) {
      return;
    }

    const tag: Tag = other.requireComponent(Tag);

    if (tag.value !== "Player") {
      return;
    }

    if (!reportsPair(this.entityId, other.id)) {
      return;
    }

    const otherTransform: Transform2D | undefined =
      other.getComponent(Transform2D);
    const otherBody: RigidBody | undefined = other.getComponent(RigidBody);

    if (otherTransform === undefined || otherBody === undefined) {
      return;
    }

    this.playBump(impactSpeedBetween(
      this.transform.position,
      this.rigidBody.velocity,
      otherTransform.position,
      otherBody.velocity,
    ));
  }
}

registerScriptMetadata(PlayerSoundScript, {
  exposed: {
    bumpAudio: ScriptMetadata.field({ required: true }),
    maxImpactSpeed: ScriptMetadata.field({ required: true }),
    minVolume: ScriptMetadata.field({ required: true }),
    maxVolume: ScriptMetadata.field({ required: true }),
    minPitch: ScriptMetadata.field({ required: true }),
    maxPitch: ScriptMetadata.field({ required: true }),
    pitchJitter: ScriptMetadata.field({ required: true }),
  },
});
