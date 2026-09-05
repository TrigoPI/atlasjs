import { Easing, Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  ParticleEmitter,
  registerScriptMetadata,
  ScriptMetadata,
  Tag,
  Transform,
  Transform2D,
  type Collision,
  type GameEntity,
} from "@atlasjs/gameplay";

import { PlayerFallScript } from "./PlayerFallScript";

type PlayerCollisionScriptProps = {
  dust: GameEntity;
  dustBurst: number;
  squishScale: number;
  squishDuration: number;
  squishDamping: number;
  squishFrequency: number;
};

export class PlayerCollisionScript extends AtlasScript<PlayerCollisionScriptProps> {
  private readonly dust: GameEntity;
  private readonly dustBurst: number;
  private readonly squishScale: number;
  private readonly squishDuration: number;
  private readonly squishDamping: number;
  private readonly squishFrequency: number;

  private readonly baseScale: Vec2 = new Vec2();

  private transform: Transform2D;
  private dustEmitter: ParticleEmitter;
  private dustTransform: Transform;
  private fall: PlayerFallScript | undefined;
  private elapsed: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.dustEmitter = this.dust.requireComponent(ParticleEmitter);
    this.dustTransform = this.dust.requireComponent(Transform);
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

  public onCollisionEnter(
    other: GameEntity,
    collision: Collision | null,
  ): void {
    if (!other.hasComponent(Tag)) {
      return;
    }

    const tag: Tag = other.requireComponent(Tag);

    if (tag.value !== "Player") {
      return;
    }

    this.elapsed = 0;
    this.placeDust(collision);
    this.dustEmitter.emit(this.dustBurst);
  }

  private placeDust(collision: Collision | null): void {
    if (collision === null) {
      this.dustTransform.setPosition(0, 0);
      return;
    }

    const inverseScale: number = 1 / this.baseScale.x;

    this.dustTransform.setPosition(
      (collision.point.x - this.transform.position.x) * inverseScale,
      (collision.point.y - this.transform.position.y) * inverseScale,
    );
  }
}

registerScriptMetadata(PlayerCollisionScript, {
  exposed: {
    dust: ScriptMetadata.entity({ required: true }),
    dustBurst: ScriptMetadata.field({ required: true }),
    squishScale: ScriptMetadata.field({ required: true }),
    squishDuration: ScriptMetadata.field({ required: true }),
    squishDamping: ScriptMetadata.field({ required: true }),
    squishFrequency: ScriptMetadata.field({ required: true }),
  },
});
