import { ServiceRegistry } from "@atlasjs/core";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { AtlasScript, ScriptConstructor, ScriptID } from "../core";
export declare class ScriptManager {
    private readonly records;
    private readonly recordsByEntity;
    private readonly idGenerator;
    private readonly world;
    private readonly services;
    private readonly pendingCreate;
    private readonly pendingDestroy;
    constructor(world: NexusWorld, services: ServiceRegistry);
    attach<TScript extends AtlasScript>(entityId: Entity, ScriptType: ScriptConstructor<TScript>): TScript;
    destroyById(scriptId: ScriptID): void;
    destroyAllByEntity(entityId: Entity): void;
    update(dt: number): void;
    fixedUpdate(): void;
    setEnabled(scriptId: ScriptID, enabled: boolean): void;
    getScriptsByEntity(entityId: Entity): readonly AtlasScript[];
    private flushCreates;
    private flushDestroys;
}
//# sourceMappingURL=ScriptManager.d.ts.map