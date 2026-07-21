import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

const BRAND: unique symbol = Symbol("ScriptComponentToken");

// prettier-ignore
export interface ScriptComponentToken<TApi, TEngine extends object, TArgs extends unknown[]> {
  readonly [BRAND]: true;
  readonly engine: Component<TEngine, TArgs>;
  create(world: NexusWorld, entity: Entity): TApi;
}

// prettier-ignore
export function defineScriptComponent<TEngine extends object, TArgs extends unknown[]>(engine: Component<TEngine, TArgs>): Component<TEngine, TArgs>;
// prettier-ignore
export function defineScriptComponent<TApi, TEngine extends object, TArgs extends unknown[]>(engine: Component<TEngine, TArgs>, create: (world: NexusWorld, entity: Entity) => TApi): ScriptComponentToken<TApi, TEngine, TArgs>;
// prettier-ignore
export function defineScriptComponent<TApi, TEngine extends object, TArgs extends unknown[]>(engine: Component<TEngine, TArgs>, create?: (world: NexusWorld, entity: Entity) => TApi): Component<TEngine, TArgs> | ScriptComponentToken<TApi, TEngine, TArgs> {
  if (create === undefined) {
    return engine;
  }

  return { [BRAND]: true, engine, create };
}

// prettier-ignore
export function isScriptComponentToken(type: unknown): type is ScriptComponentToken<unknown, object, unknown[]> {
  return typeof type === "object" && type !== null && BRAND in type;
}
