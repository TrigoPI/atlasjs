export interface SortingLayerInput {
  readonly name: string;
  readonly groupPath: readonly string[];
}

export interface GroupNameSortingOptions {
  readonly override?: Readonly<Record<string, string>>;
  readonly fallback?: string;
}

export function groupNameSortingResolver(
  knownLayers: readonly string[],
  opts?: GroupNameSortingOptions,
): (layer: SortingLayerInput) => string {
  const canonical: Map<string, string> = new Map<string, string>();
  for (const name of knownLayers) {
    canonical.set(name.toLowerCase(), name);
  }

  const override: Readonly<Record<string, string>> = opts?.override ?? {};
  const fallback: string = opts?.fallback ?? "Default";

  return (layer: SortingLayerInput): string => {
    const overridden: string | undefined = override[layer.name];
    if (overridden !== undefined) {
      return overridden;
    }

    for (let i: number = layer.groupPath.length - 1; i >= 0; i--) {
      const match: string | undefined = canonical.get(layer.groupPath[i].toLowerCase());
      if (match !== undefined) {
        return match;
      }
    }

    return fallback;
  };
}
