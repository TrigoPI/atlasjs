import { Sprite } from "@atlasjs/nebula";
import { SpriteRender, Transform2D } from "../components";
import { SparseSet } from "@atlasjs/nexus";
export class SpriteRenderSystem {
    mountedEntities;
    nebula;
    sampler;
    constructor(nebula) {
        this.mountedEntities = new SparseSet();
        this.nebula = nebula;
        this.sampler = nebula.createSampler({
            magFilter: "nearest",
            minFilter: "nearest",
        });
    }
    update({ world }) {
        world.query(Transform2D, SpriteRender).each((entity, transform, spriteRender) => {
            let sprite = this.mountedEntities.get(entity);
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
//# sourceMappingURL=SpriteRenderSystem.js.map