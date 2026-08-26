import type { AtlasScript } from "./AtlasScript";
import type { PropsOf } from "./AttachArgs";
import type { GameEntity } from "./GameEntity";

export type ExposeValueMetadata = { type: "field"; required?: boolean };

export type ExposeEntityMetadata = { type: "entity"; required?: boolean };

export type ExposeFieldMetadata = ExposeValueMetadata | ExposeEntityMetadata;

export type ExposeFor<TValue> = [NonNullable<TValue>] extends [GameEntity]
  ? ExposeEntityMetadata
  : ExposeValueMetadata;

export type ExposedFor<TProps, TKeys extends keyof TProps> = {
  [K in TKeys]: ExposeFor<TProps[K]>;
};

export interface ScriptMetadata {
  exposed: Record<string, ExposeFieldMetadata>;
}

export const ScriptMetadata = {
  field(options: { required?: boolean } = {}): ExposeValueMetadata {
    return { type: "field", required: options.required };
  },
  entity(options: { required?: boolean } = {}): ExposeEntityMetadata {
    return { type: "entity", required: options.required };
  },
};

const REGISTRY: WeakMap<Function, ScriptMetadata> = new WeakMap();

let MERGED: WeakMap<Function, ScriptMetadata | null> = new WeakMap();

export function registerScriptMetadata<
  TScript extends AtlasScript<object>,
  TKeys extends keyof PropsOf<TScript>,
>(
  ctor: abstract new (...args: never[]) => TScript,
  metadata: { exposed: ExposedFor<PropsOf<TScript>, TKeys> },
): void;
export function registerScriptMetadata(
  ctor: Function,
  metadata: ScriptMetadata,
): void {
  REGISTRY.set(ctor, metadata);
  MERGED = new WeakMap<Function, ScriptMetadata | null>();
}

function mergeScriptMetadata(ctor: Function): ScriptMetadata | null {
  const chain: Function[] = [];
  let current: Function | null = ctor;

  while (current !== null && current !== Function.prototype) {
    chain.push(current);
    current = Object.getPrototypeOf(current);
  }

  let merged: Record<string, ExposeFieldMetadata> | undefined;

  for (let i: number = chain.length - 1; i >= 0; i--) {
    const own: ScriptMetadata | undefined = REGISTRY.get(chain[i]);

    if (own === undefined) {
      continue;
    }

    merged = merged ?? {};

    for (const field of Object.keys(own.exposed)) {
      merged[field] = Object.freeze({ ...own.exposed[field] });
    }
  }

  return merged === undefined
    ? null
    : Object.freeze({ exposed: Object.freeze(merged) });
}

export function getScriptMetadata(ctor: Function): ScriptMetadata | undefined {
  const cached: ScriptMetadata | null | undefined = MERGED.get(ctor);

  if (cached !== undefined) {
    return cached ?? undefined;
  }

  const merged: ScriptMetadata | null = mergeScriptMetadata(ctor);
  MERGED.set(ctor, merged);

  return merged ?? undefined;
}

export function getExposedFields(
  ctor: Function,
): Map<string, ExposeFieldMetadata> {
  const metadata: ScriptMetadata | undefined = getScriptMetadata(ctor);
  const fields: Map<string, ExposeFieldMetadata> = new Map<
    string,
    ExposeFieldMetadata
  >();

  if (metadata === undefined) {
    return fields;
  }

  for (const field of Object.keys(metadata.exposed)) {
    fields.set(field, { ...metadata.exposed[field] });
  }

  return fields;
}
