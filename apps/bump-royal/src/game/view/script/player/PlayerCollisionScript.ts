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

import { PlayerStatus } from "../../../sim";

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
  private status: PlayerStatus;
  private elapsed: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.dustEmitter = this.dust.requireComponent(ParticleEmitter);
    this.dustTransform = this.dust.requireComponent(Transform);
    this.baseScale.copyFrom(this.transform.scale);
    this.elapsed = this.squishDuration;
    this.status = this.requireComponent(PlayerStatus);
  }

  // prettier-ignore
  public onUpdate(dt: number): void {
    if (this.status.falling) {
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

  /* World-space contact point. Called by the local solver offline and by a replicated bump
     event online, so both modes squish and spray from the same code. */
  public playBump(px: number, py: number): void {
    this.elapsed = 0;
    this.placeDust(px, py);
    this.dustEmitter.emit(this.dustBurst);
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

    /* A backend with no contact data falls back to this entity's own centre, which the offset
       below turns into the local origin the script used before contact points existed. */
    const point: Vec2 =
      collision === null ? this.transform.position : collision.point;

    this.playBump(point.x, point.y);
  }

  /* The dust anchor is a child, so its transform is local and the parent's scale multiplies it:
     the world offset has to be divided by that scale before being written. baseScale and not
     transform.scale — the squish this same call starts would otherwise skew the anchor. */
  private placeDust(px: number, py: number): void {
    const inverseScale: number = 1 / this.baseScale.x;

    this.dustTransform.setPosition(
      (px - this.transform.position.x) * inverseScale,
      (py - this.transform.position.y) * inverseScale,
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
