import { NebulaRenderer } from "@atlasjs/nebula";
import { NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
export declare class SpriteRenderSystem implements NexusSystem {
    private readonly mountedEntities;
    private readonly nebula;
    private readonly sampler;
    constructor(nebula: NebulaRenderer);
    update({ world }: NexusSystemContext): void;
}
//# sourceMappingURL=SpriteRenderSystem.d.ts.map