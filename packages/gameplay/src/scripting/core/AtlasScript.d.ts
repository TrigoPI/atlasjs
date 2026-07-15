import { Component, Entity } from "@atlasjs/nexus";
import { ScriptComponentCtor } from "./ScriptComponent";
import { ScriptServiceCtor } from "./ScriptService";
import { ScriptContext } from "./ScriptContext";
import { ScriptLifecycle } from "./ScriptLifeCycle";
export declare abstract class AtlasScript implements ScriptLifecycle {
    private __context?;
    onCreate?(): void;
    onUpdate?(dt: number): void;
    onFixedUpdate?(): void;
    onDestroy?(): void;
    __bindContext(context: ScriptContext): void;
    __unbindContext(): void;
    protected get context(): ScriptContext;
    get entityId(): Entity;
    getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade;
    hasComponent<TComponent extends object>(type: Component<TComponent, any[]>): boolean;
    getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
    addComponent<TFacade, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentCtor<TFacade, TEngine, TArgs>, ...args: TArgs): TFacade;
    addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
    removeComponent<TComponent extends object>(type: Component<TComponent, any[]>): void;
    requireComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent;
}
//# sourceMappingURL=AtlasScript.d.ts.map