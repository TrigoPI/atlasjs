import { AudioClip, AudioVoice } from "@atlasjs/audio";

export class FakeAudioVoice implements AudioVoice {
  public finished: boolean = false;
  public stopped: boolean = false;
  public apply(_volume: number, _muted: boolean): void {}
  public stop(): void {
    this.stopped = true;
    this.finished = true;
  }
}

export class FakeAudioEngine {
  public readonly voices: FakeAudioVoice[] = [];
  public readonly oneShots: Array<[AudioClip, number | undefined]> = [];
  public masterVolume: number = 1;
  public muted: boolean = false;

  public decode(_data: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 1 } as AudioBuffer);
  }
  public playOneShot(clip: AudioClip, volume?: number): void {
    this.oneShots.push([clip, volume]);
  }
  public createVoice(
    _clip: AudioClip,
    _opts: { loop: boolean; volume: number; mute: boolean },
  ): AudioVoice {
    const voice: FakeAudioVoice = new FakeAudioVoice();
    this.voices.push(voice);
    return voice;
  }
  public destroy(): void {}
}
