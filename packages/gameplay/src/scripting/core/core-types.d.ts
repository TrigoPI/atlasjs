import { Entity } from "@atlasjs/nexus";
import { AtlasScript } from "./AtlasScript";
export type ScriptID = number & {
    readonly __kind: "ScriptID";
};
export type ScriptConstructor<T extends AtlasScript = AtlasScript> = new () => T;
export type ScriptInstanceRecord<TScript extends AtlasScript = AtlasScript> = {
    scriptType: ScriptConstructor<TScript>;
    scriptId: ScriptID;
    entityId: Entity;
    instance: TScript;
    isCreated: boolean;
    isDestroyed: boolean;
    isEnabled: boolean;
};
//# sourceMappingURL=core-types.d.ts.map