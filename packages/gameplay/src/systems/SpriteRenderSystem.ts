import { Vec2 } from "@atlasjs/math";
import { Sprite } from "@atlasjs/nebula";
import { SpriteRender, WorldTransform2D } from "../components";
import { applySortFields } from "../rendering/applySortFields";
import type { SortingLayers } from "../rendering";

import { Color, NebulaRenderer, Sampler, SpriteNode } from "@atlasjs/nebula";

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
  private readonly positionScratch: Vec2;
  private readonly scaleScratch: Vec2;
  private readonly sortScratch: Vec2;
  private readonly sortingLayers: SortingLayers;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.mounted = new SparseSet<MountedSprite>();
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
    this.sortScratch = new Vec2();
    this.sampler = nebula.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world.query(WorldTransform2D, SpriteRender).each((entity: Entity, worldTransform: WorldTransform2D, spriteRender: SpriteRender) => {
      const node: SpriteNode = this.resolveNode(entity, spriteRender.sprite);

      const position: Vec2 = worldTransform.getPosition(this.positionScratch);
      const rotation: number = worldTransform.getRotation();
      const scale: Vec2 = worldTransform.getScale(this.scaleScratch);

      const scaleX: number = scale.x * (spriteRender.flipX ? -1 : 1);
      const scaleY: number = scale.y * (spriteRender.flipY ? -1 : 1);
      const color: Color = spriteRender.color;

      node
        .setPosition(position.x, position.y)
        .setRotation(rotation)
        .setScale(scaleX, scaleY)
        .setTint(color.r, color.g, color.b, color.a)
        .setVisible(spriteRender.visible);

      let sortY: number = position.y;

      // prettier-ignore
      if (spriteRender.sortPointEntity !== null && world.exists(spriteRender.sortPointEntity)) {
        const carrier: WorldTransform2D | undefined = world.getComponent(
          spriteRender.sortPointEntity,
          WorldTransform2D,
        );

        if (carrier !== undefined) {
          sortY = carrier.getPosition(this.sortScratch).y;
        }
      }

      applySortFields(
        node,
        this.sortingLayers,
        spriteRender.sortingLayer,
        spriteRender.sortingOrder,
        sortY,
      );
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
