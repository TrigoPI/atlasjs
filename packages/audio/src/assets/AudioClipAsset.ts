import { Asset } from "@atlasjs/assets";

export interface AudioClipAssetOptions {
  readonly id?: string;
}

export class AudioClipAsset implements Asset {
  public readonly type: string = "audio";
  public readonly id: string;
  public readonly source: string;

  public constructor(source: string, options?: AudioClipAssetOptions) {
    this.source = source;
    this.id = options?.id ?? `audio:${source}`;
  }
}
