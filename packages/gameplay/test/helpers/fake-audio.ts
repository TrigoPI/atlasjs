import { AudioClip, AudioVoice, PlaybackParams } from "@atlasjs/audio";

export class FakeAudioVoice implements AudioVoice {
  public finished: boolean = false;
  public stopped: boolean = false;
  public apply(_volume: number, _muted: boolean, _pitch: number): void {}
  public stop(): void {
    this.stopped = true;
    this.finished = true;
  }
}

export class FakeAudioEngine {
  public readonly voices: FakeAudioVoice[] = [];
  public readonly oneShots: Array<[AudioClip, PlaybackParams | undefined]> = [];
  public masterVolume: number = 1;
  public muted: boolean = false;

  public decode(_data: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 1 } as AudioBuffer);
  }
  public playOneShot(clip: AudioClip, params?: PlaybackParams): void {
    this.oneShots.push([clip, params]);
  }
  public createVoice(
    _clip: AudioClip,
    _opts: { loop: boolean; volume: number; mute: boolean; pitch?: number },
  ): AudioVoice {
    const voice: FakeAudioVoice = new FakeAudioVoice();
    this.voices.push(voice);
    return voice;
  }
  public destroy(): void {}
}
