import { ServiceRegistry } from "@atlasjs/core";
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";
import { ScriptComponentCtor, ScriptContext, ScriptServiceCtor } from "../core";
export declare class RuntimeScriptContext implements ScriptContext {
    private readonly entity;
    private readonly world;
    private readonly services;
    constructor(entity: Entity, world: NexusWorld, services: ServiceRegistry);
    getEntityId(): Entity;
    getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade;
    hasComponent<TComponent extends object>(type: Component<TComponent, any[]>): boolean;
    getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
    addComponent<TFacade, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentCtor<TFacade, TEngine, TArgs>, ...args: TArgs): TFacade;
    addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
    removeComponent<TComponent extends object>(type: Component<TComponent, any[]>): void;
    private isFacade;
}
//# sourceMappingURL=RuntimeScriptContext.d.ts.map