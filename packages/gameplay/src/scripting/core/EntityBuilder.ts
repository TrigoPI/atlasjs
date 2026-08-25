import type { Component, Entity } from "@atlasjs/nexus";

import type { AtlasScript } from "./AtlasScript";
import type { AttachArgs } from "./AttachArgs";
import type { ScriptComponentToken } from "./ScriptComponentToken";
import type { ScriptConstructor } from "./core-types";

// prettier-ignore
export interface EntityBuilder {
  readonly entity: Entity;
  add<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  add<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  attach<TScript extends AtlasScript>(Script: ScriptConstructor<TScript>, ...rest: AttachArgs<TScript>): TScript;
  child(build: (entity: EntityBuilder) => void): EntityBuilder;
}
