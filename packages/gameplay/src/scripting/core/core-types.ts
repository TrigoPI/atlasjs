import { Entity } from "@atlasjs/nexus";
import { AtlasScript } from "./AtlasScript";
import { ScriptContext } from "./ScriptContext";

export type ScriptID = number & { readonly __kind: "ScriptID" };

export type ScriptConstructor<T extends AtlasScript = AtlasScript> =
  new () => T;

export type ScriptInstanceRecord<TScript extends AtlasScript = AtlasScript> = {
  scriptType: ScriptConstructor<TScript>;
  scriptId: ScriptID;
  entityId: Entity;
  instance: TScript;
  context: ScriptContext;
  isCreated: boolean;
  isDestroyed: boolean;
  isEnabled: boolean;
};
