import type { SpriteAnimation, SpriteSheet, Texture2D } from "@atlasjs/nebula";

import type { AssetsLoader } from "../loaders";
import type { ClipBuilder, SheetDescriptor } from "./sheets/sheets.types";

type SheetEntry = {
  sheet: SpriteSheet;
  clips: ClipBuilder;
};

export class SheetLoader {
  private readonly assetsLoader: AssetsLoader;
  private readonly descriptors: SheetDescriptor[];
  private readonly registry: Record<string, SheetEntry>;

  public constructor(assetsLoader: AssetsLoader) {
    this.assetsLoader = assetsLoader;
    this.descriptors = [];
    this.registry = {};
  }

  public addSheet(descriptor: SheetDescriptor): SheetLoader {
    this.descriptors.push(descriptor);
    return this;
  }

  public build(): void {
    for (const descriptor of this.descriptors) {
      const texture: Texture2D = this.assetsLoader.getAsset<Texture2D>(
        descriptor.texture,
      );
      const sheet: SpriteSheet = descriptor.sheet(texture);
      this.registry[descriptor.name] = { sheet, clips: descriptor.clips };
    }
  }

  public createClips(name: string): Record<string, SpriteAnimation> {
    const entry: SheetEntry | undefined = this.registry[name];

    if (!entry) {
      throw new Error(`Sheet not found: ${name}`);
    }

    return entry.clips(entry.sheet);
  }
}
