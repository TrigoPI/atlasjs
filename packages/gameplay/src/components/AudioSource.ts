import { AudioClip } from "@atlasjs/audio";

export type AudioSourceCommand = "none" | "play" | "stop";

export interface AudioSourceOptions {
  volume?: number;
  loop?: boolean;
  mute?: boolean;
  playOnAwake?: boolean;
  pitch?: number;
}

export class AudioSource {
  public clip: AudioClip | null;
  public volume: number;
  public pitch: number;
  public loop: boolean;
  public mute: boolean;
  public playOnAwake: boolean;
  public command: AudioSourceCommand;
  public isPlaying: boolean;

  public constructor(
    clip: AudioClip | null = null,
    options?: AudioSourceOptions,
  ) {
    this.clip = clip;
    this.volume = options?.volume ?? 1;
    this.pitch = options?.pitch ?? 1;
    this.loop = options?.loop ?? false;
    this.mute = options?.mute ?? false;
    this.playOnAwake = options?.playOnAwake ?? false;
    this.command = "none";
    this.isPlaying = false;
  }

  public play(): this {
    this.command = "play";
    return this;
  }

  public stop(): this {
    this.command = "stop";
    return this;
  }
}
