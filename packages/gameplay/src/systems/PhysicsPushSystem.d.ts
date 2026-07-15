import { PhysicsWorld } from "@atlasjs/inertia";
import { NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
export declare class PhysicsPushSystem implements NexusSystem {
    private readonly inertia;
    private readonly pending;
    constructor(inertia: PhysicsWorld);
    update({ world }: NexusSystemContext): void;
}
//# sourceMappingURL=PhysicsPushSystem.d.ts.map