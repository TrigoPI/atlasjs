import { Frame } from "@atlasjs/nebula";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { Sprite } from "@atlasjs/nebula";
import { Animator, SpriteRender } from "../components";
import type { TimeScaleManager } from "../time";

export class AnimatorSystem implements NexusSystem {
  private readonly spriteCache: Map<Frame, Sprite>;
  private readonly timeScale: TimeScaleManager | undefined;

  public constructor(timeScale?: TimeScaleManager) {
    this.spriteCache = new Map<Frame, Sprite>();
    this.timeScale = timeScale;
  }

  // prettier-ignore
  public update({ world, dt }: NexusSystemContext): void {
    world.query(Animator, SpriteRender).each((entity: Entity, animator: Animator, spriteRender: SpriteRender) => {
      animator.tick(dt * this.scaleFor(entity) * 1000);

      const frame: Frame | null = animator.currentFrame();
      if (frame === null) return;

      const sprite: Sprite = this.spriteFor(frame);
      if (spriteRender.sprite !== sprite) {
        spriteRender.sprite = sprite;
      }
    });
  }

  private scaleFor(entity: Entity): number {
    return this.timeScale === undefined ? 1 : this.timeScale.scaleOf(entity);
  }

  private spriteFor(frame: Frame): Sprite {
    let sprite: Sprite | undefined = this.spriteCache.get(frame);

    if (sprite === undefined) {
      sprite = new Sprite(frame.texture, {
        rect: frame.rect,
        pivot: frame.pivot,
      });
      this.spriteCache.set(frame, sprite);
    }

    return sprite;
  }
}
