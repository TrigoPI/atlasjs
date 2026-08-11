import { Resource } from "@atlasjs/assets";

export class AudioClip implements Resource {
  public readonly id: string;
  public readonly buffer: AudioBuffer;

  public constructor(id: string, buffer: AudioBuffer) {
    this.id = id;
    this.buffer = buffer;
  }

  public get duration(): number {
    return this.buffer.duration;
  }

  public destroy(): void {}
}
