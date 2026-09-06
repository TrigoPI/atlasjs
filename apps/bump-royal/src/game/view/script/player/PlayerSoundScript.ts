import { MathUtils, Vec2 } from "@atlasjs/math";
import { randomRange } from "@atlasjs/utils";
import type { AudioClip } from "@atlasjs/audio";

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

  private readonly relativeVelocity: Vec2 = new Vec2();
  private readonly normal: Vec2 = new Vec2();

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

    if (this.entityId > other.id) {
      return;
    }

    const otherTransform: Transform2D | undefined =
      other.getComponent(Transform2D);
    const otherBody: RigidBody | undefined = other.getComponent(RigidBody);

    if (otherTransform === undefined || otherBody === undefined) {
      return;
    }

    const impactSpeed: number = this.impactSpeedAgainst(this.rigidBody, otherTransform, otherBody);
    const t: number = MathUtils.clamp(impactSpeed / this.maxImpactSpeed, 0, 1);
    const pitch: number = MathUtils.lerp(this.maxPitch, this.minPitch, t);
    const jitter: number = randomRange(-this.pitchJitter, this.pitchJitter);

    this.audio.playOneShot(this.bumpAudio, {
      volume: MathUtils.lerp(this.minVolume, this.maxVolume, t),
      pitch: Math.max(0.01, pitch + jitter),
    });
  }

  // prettier-ignore
  private impactSpeedAgainst(
    body: RigidBody,
    otherTransform: Transform2D,
    otherBody: RigidBody,
  ): number {
    Vec2.subTo(body.velocity, otherBody.velocity, this.relativeVelocity);
    Vec2.subTo(otherTransform.position, this.transform.position, this.normal);
    this.normal.normalize();

    return Math.abs(this.relativeVelocity.dot(this.normal));
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
