import { createLogger, Logger } from "@atlasjs/utils";

export type SortMode = "manual" | "ySorted";

interface LayerEntry {
  name: string;
  mode: SortMode;
}

export class SortingLayers {
  private readonly logger: Logger;
  private readonly layers: LayerEntry[];
  private readonly index: Map<string, number>;

  public constructor() {
    this.logger = createLogger(SortingLayers.name);
    this.layers = [{ name: "Default", mode: "manual" }];
    this.index = new Map<string, number>([["Default", 0]]);
  }

  public define(defs: ReadonlyArray<{ name: string; mode?: SortMode }>): this {
    for (const def of defs) {
      if (this.index.has(def.name)) {
        this.logger.warn(`Sorting layer '${def.name}' already defined; ignored.`);
        continue;
      }

      const entry: LayerEntry = { name: def.name, mode: def.mode ?? "manual" };
      this.index.set(def.name, this.layers.length);
      this.layers.push(entry);
    }

    return this;
  }

  public indexOf(name: string): number {
    const found: number | undefined = this.index.get(name);

    if (found === undefined) {
      this.logger.warn(`Unknown sorting layer '${name}'; using 'Default'.`);
      return 0;
    }

    return found;
  }

  public modeOf(index: number): SortMode {
    const entry: LayerEntry | undefined = this.layers[index];
    return entry ? entry.mode : "manual";
  }
}
