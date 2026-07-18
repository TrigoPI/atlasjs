export interface ExposeFieldMetadata {
  required?: boolean;
}

export interface ScriptMetadata {
  exposed: Record<string, ExposeFieldMetadata>;
}

const REGISTRY: WeakMap<Function, ScriptMetadata> = new WeakMap();

export function registerScriptMetadata(
  ctor: Function,
  metadata: ScriptMetadata,
): void {
  REGISTRY.set(ctor, metadata);
}

export function getScriptMetadata(ctor: Function): ScriptMetadata | undefined {
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

    merged = { ...(merged ?? {}), ...own.exposed };
  }

  return merged === undefined ? undefined : { exposed: merged };
}

export function getExposedFields(
  ctor: Function,
): Map<string, ExposeFieldMetadata> {
  const metadata: ScriptMetadata | undefined = getScriptMetadata(ctor);
  return new Map<string, ExposeFieldMetadata>(
    Object.entries(metadata?.exposed ?? {}),
  );
}
