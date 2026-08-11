import { AssetLoader } from "@atlasjs/assets";

import { AudioEngine } from "../AudioEngine";
import { AudioClipAsset } from "./AudioClipAsset";
import { AudioClip } from "./AudioClip";

export class AudioLoader implements AssetLoader<AudioClipAsset, AudioClip> {
  public readonly type: string = "audio";
  private readonly engine: AudioEngine;

  public constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  public async load(asset: AudioClipAsset): Promise<AudioClip> {
    const response: Response = await fetch(asset.source);
    if (!response.ok) {
      throw new Error(
        `Failed to load audio "${asset.source}": ${response.status}`,
      );
    }
    const data: ArrayBuffer = await response.arrayBuffer();
    const buffer: AudioBuffer = await this.engine.decode(data);
    return new AudioClip(asset.id, buffer);
  }
}
