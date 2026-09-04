import { Easing, Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  ParticleEmitter,
  registerScriptMetadata,
  ScriptMetadata,
  Tag,
  Transform2D,
  type GameEntity,
} from "@atlasjs/gameplay";

import { PlayerFallScript } from "./PlayerFallScript";

type PlayerCollisionScriptProps = {
  dust: ParticleEmitter;
  dustBurst: number;
  squishScale: number;
  squishDuration: number;
  squishDamping: number;
  squishFrequency: number;
};

export class PlayerCollisionScript extends AtlasScript<PlayerCollisionScriptProps> {
  private readonly dust: ParticleEmitter;
  private readonly dustBurst: number;
  private readonly squishScale: number;
  private readonly squishDuration: number;
  private readonly squishDamping: number;
  private readonly squishFrequency: number;

  private readonly baseScale: Vec2 = new Vec2();

  private transform: Transform2D;
  private fall: PlayerFallScript | undefined;
  private elapsed: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.baseScale.copyFrom(this.transform.scale);
    this.elapsed = this.squishDuration;
    this.fall = this.getEntity(this.entityId).getScript(PlayerFallScript);
  }

  // prettier-ignore
  public onUpdate(dt: number): void {
    if (this.fall?.isFalling === true) {
      this.elapsed = this.squishDuration;
      return;
    }

    if (this.elapsed >= this.squishDuration) {
      return;
    }

    this.elapsed = Math.min(this.elapsed + dt, this.squishDuration);

    if (this.elapsed >= this.squishDuration) {
      this.transform.scale.copyFrom(this.baseScale);
      return;
    }

    const t: number = this.elapsed / this.squishDuration;
    const spring: number = Easing.spring(t, this.squishDamping, this.squishFrequency);
    const factor: number = 1 + (this.squishScale - 1) * (1 - spring);

    this.transform.scale.copyFrom(this.baseScale).mult(factor);
  }

  public onCollisionEnter(other: GameEntity): void {
    if (!other.hasComponent(Tag)) {
      return;
    }

    const tag: Tag = other.requireComponent(Tag);

    if (tag.value !== "Player") {
      return;
    }

    this.elapsed = 0;
    this.dust.emit(this.dustBurst);
  }
}

registerScriptMetadata(PlayerCollisionScript, {
  exposed: {
    dust: ScriptMetadata.field({ required: true }),
    dustBurst: ScriptMetadata.field({ required: true }),
    squishScale: ScriptMetadata.field({ required: true }),
    squishDuration: ScriptMetadata.field({ required: true }),
    squishDamping: ScriptMetadata.field({ required: true }),
    squishFrequency: ScriptMetadata.field({ required: true }),
  },
});
