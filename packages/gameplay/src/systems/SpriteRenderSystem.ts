import { Sprite } from "../assets";
import { SpriteRender, Transform2D } from "../components";

import {
  Color,
  NebulaRenderer,
  Sampler,
  Sprite as SpriteNode,
} from "@atlasjs/nebula";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  SparseSet,
} from "@atlasjs/nexus";

interface MountedSprite {
  node: SpriteNode;
  sprite: Sprite;
}

export class SpriteRenderSystem implements NexusSystem {
  private readonly mounted: SparseSet<MountedSprite>;
  private readonly nebula: NebulaRenderer;
  private readonly sampler: Sampler;

  public constructor(nebula: NebulaRenderer) {
    this.mounted = new SparseSet<MountedSprite>();
    this.nebula = nebula;
    this.sampler = nebula.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(Transform2D, SpriteRender).each((entity, transform, spriteRender) => {
      const node: SpriteNode = this.resolveNode(entity, spriteRender.sprite);

      const scaleX: number = transform.scale.x * (spriteRender.flipX ? -1 : 1);
      const scaleY: number = transform.scale.y * (spriteRender.flipY ? -1 : 1);
      const color: Color = spriteRender.color;

      node
        .setPosition(transform.position.x, transform.position.y)
        .setRotation(transform.rotation)
        .setScale(scaleX, scaleY)
        .setTint(color.r, color.g, color.b, color.a)
        .setVisible(spriteRender.visible);

      node.zIndex = spriteRender.sortingOrder;
    });
  }

  public unmount(entity: Entity): void {
    const mounted: MountedSprite | undefined = this.mounted.get(entity);

    if (mounted === undefined) {
      return;
    }

    mounted.node.removeFromParent();
    this.mounted.delete(entity);
  }

  private resolveNode(entity: Entity, sprite: Sprite): SpriteNode {
    const mounted: MountedSprite | undefined = this.mounted.get(entity);

    if (mounted === undefined) {
      return this.mount(entity, sprite).node;
    }

    if (mounted.sprite === sprite) {
      return mounted.node;
    }

    if (mounted.node.texture !== sprite.texture) {
      this.unmount(entity);
      return this.mount(entity, sprite).node;
    }

    mounted.node.setAnchor(sprite.pivot.x, sprite.pivot.y);
    mounted.node.setSourceRect(
      sprite.rect.x,
      sprite.rect.y,
      sprite.rect.width,
      sprite.rect.height,
    );

    mounted.sprite = sprite;

    return mounted.node;
  }

  private mount(entity: Entity, sprite: Sprite): MountedSprite {
    const node: SpriteNode = new SpriteNode(sprite.texture, this.sampler);
    node.setAnchor(sprite.pivot.x, sprite.pivot.y);
    node.setSourceRect(
      sprite.rect.x,
      sprite.rect.y,
      sprite.rect.width,
      sprite.rect.height,
    );

    this.nebula.scene.addChild(node);

    const mounted: MountedSprite = { node, sprite };
    this.mounted.set(entity, mounted);

    return mounted;
  }
}
