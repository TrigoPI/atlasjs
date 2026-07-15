import { Component, Entity, NexusWorld } from "@atlasjs/nexus";
export interface ScriptComponentCtor<TFacade, TEngine extends object, TArgs extends unknown[]> {
    new (world: NexusWorld, entity: Entity): TFacade;
    readonly engine: Component<TEngine, TArgs>;
}
export declare abstract class ScriptComponent<TEngine extends object> {
    protected readonly world: NexusWorld;
    protected readonly entity: Entity;
    constructor(world: NexusWorld, entity: Entity);
    protected resolve(): TEngine;
}
//# sourceMappingURL=ScriptComponent.d.ts.map