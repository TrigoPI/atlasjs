import { AudioVoice } from "./AudioVoice";

export class Voice implements AudioVoice {
  public finished: boolean = false;
  private readonly source: AudioBufferSourceNode;
  private readonly gain: GainNode;

  public constructor(source: AudioBufferSourceNode, gain: GainNode) {
    this.source = source;
    this.gain = gain;
    this.source.onended = (): void => {
      this.finished = true;
    };
  }

  public apply(volume: number, muted: boolean): void {
    this.gain.gain.value = muted ? 0 : Math.max(0, volume);
  }

  public stop(): void {
    this.finished = true;

    try {
      this.source.stop();
    } catch {
      void 0;
    }

    this.source.disconnect();
    this.gain.disconnect();
  }
}
