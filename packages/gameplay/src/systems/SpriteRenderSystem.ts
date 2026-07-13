import { NebulaRenderer, Sampler, Sprite } from "@atlasjs/nebula";
import { SpriteRender, Transform2D } from "../components";

import { NexusSystem, NexusSystemContext, SparseSet } from "@atlasjs/nexus";

export class SpriteRenderSystem implements NexusSystem {
  private readonly mountedEntities: SparseSet<Sprite>;
  private readonly nebula: NebulaRenderer;
  private readonly sampler: Sampler;

  public constructor(nebula: NebulaRenderer) {
    this.mountedEntities = new SparseSet<Sprite>();
    this.nebula = nebula;
    this.sampler = nebula.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
  }

  public update({ world }: NexusSystemContext): void {
    world.query(Transform2D, SpriteRender).each((entity, transform, spriteRender) => {
      let sprite: Sprite | undefined = this.mountedEntities.get(entity);

      if (!sprite) {
        sprite = new Sprite(spriteRender.texture, this.sampler);
        this.nebula.scene.addChild(sprite);
        this.mountedEntities.set(entity, sprite);
      }

      sprite
        .setPosition(transform.position.x, transform.position.y)
        .setRotation(transform.rotation)
        .setScale(transform.scale.x, transform.scale.y)
        .setVisible(spriteRender.visible);
    });
  }
}
