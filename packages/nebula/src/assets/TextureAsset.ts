import { Asset } from "@atlasjs/assets";
import { TextureFormat } from "../core";

export interface TextureAssetOptions {
  readonly id?: string;
  readonly format?: TextureFormat;
}

export class TextureAsset implements Asset {
  public readonly type: string = "texture";
  public readonly id: string;
  public readonly source: string;
  public readonly format?: TextureFormat;

  public constructor(source: string, options?: TextureAssetOptions) {
    this.source = source;
    this.format = options?.format;
    this.id = options?.id ?? `texture:${source}`;
  }
}
