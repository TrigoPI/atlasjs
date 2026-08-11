import {
  AudioClip,
  AudioEngine,
  AUDIO_ENGINE,
  PlaybackParams,
} from "@atlasjs/audio";

import { ScriptService } from "../core";

export class AudioApi extends ScriptService<AudioEngine> {
  public static readonly token = AUDIO_ENGINE;

  public playOneShot(clip: AudioClip, params?: PlaybackParams): void {
    this.provided.playOneShot(clip, params);
  }

  public get masterVolume(): number {
    return this.provided.masterVolume;
  }
  public set masterVolume(value: number) {
    this.provided.masterVolume = value;
  }

  public get muted(): boolean {
    return this.provided.muted;
  }
  public set muted(value: boolean) {
    this.provided.muted = value;
  }
}
