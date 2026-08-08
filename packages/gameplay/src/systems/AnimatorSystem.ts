import { Frame } from "@atlasjs/nebula";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { Sprite } from "../assets";
import { Animator, SpriteRender } from "../components";

export class AnimatorSystem implements NexusSystem {
  private readonly spriteCache: Map<Frame, Sprite>;

  public constructor() {
    this.spriteCache = new Map<Frame, Sprite>();
  }

  // prettier-ignore
  public update({ world, dt }: NexusSystemContext): void {
    const deltaMs: number = dt * 1000;

    world.query(Animator, SpriteRender).each((_entity: Entity, animator: Animator, spriteRender: SpriteRender) => {
      animator.tick(deltaMs);

      const frame: Frame | null = animator.currentFrame();
      if (frame === null) return;

      const sprite: Sprite = this.spriteFor(frame);
      if (spriteRender.sprite !== sprite) {
        spriteRender.sprite = sprite;
      }
    });
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
