import { AudioClip } from "./assets/AudioClip";
import { AudioVoice } from "./AudioVoice";
import { Voice } from "./Voice";

export interface VisibilityDoc {
  readonly hidden: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface AudioEngineOptions {
  target?: EventTarget;
  doc?: VisibilityDoc;
}

const GESTURE_EVENTS: readonly string[] = [
  "pointerdown",
  "keydown",
  "touchstart",
];

export class AudioEngine {
  private readonly ctx: AudioContext;
  private readonly target: EventTarget | null;
  private readonly doc: VisibilityDoc | null;
  private readonly master: GainNode;
  private readonly onGesture: () => void;
  private readonly onVisibility: () => void;

  private _masterVolume: number = 1;
  private _muted: boolean = false;
  private unlocked: boolean = false;

  public constructor(
    ctx: AudioContext = new AudioContext(),
    options?: AudioEngineOptions,
  ) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    this.target =
      options?.target ?? (typeof window !== "undefined" ? window : null);

    this.doc =
      options?.doc ??
      (typeof document !== "undefined" ? (document as VisibilityDoc) : null);

    this.onGesture = (): void => {
      void this.unlock();
    };

    this.onVisibility = (): void => {
      this.handleVisibility();
    };

    if (this.target !== null) {
      for (const type of GESTURE_EVENTS) {
        this.target.addEventListener(type, this.onGesture);
      }
    }

    if (this.doc !== null) {
      this.doc.addEventListener("visibilitychange", this.onVisibility);
    }
  }

  public decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx.decodeAudioData(data);
  }

  public playOneShot(clip: AudioClip, volume: number = 1): void {
    const source: AudioBufferSourceNode = this.ctx.createBufferSource();
    source.buffer = clip.buffer;
    const gain: GainNode = this.ctx.createGain();
    gain.gain.value = Math.max(0, volume);
    source.connect(gain);
    gain.connect(this.master);
    source.onended = (): void => {
      source.disconnect();
      gain.disconnect();
    };

    source.start();
  }

  public createVoice(
    clip: AudioClip,
    opts: { loop: boolean; volume: number; mute: boolean },
  ): AudioVoice {
    const source: AudioBufferSourceNode = this.ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.loop = opts.loop;
    const gain: GainNode = this.ctx.createGain();
    gain.gain.value = opts.mute ? 0 : Math.max(0, opts.volume);
    source.connect(gain);
    gain.connect(this.master);
    const voice: Voice = new Voice(source, gain);
    source.start();
    return voice;
  }

  public get masterVolume(): number {
    return this._masterVolume;
  }

  public set masterVolume(value: number) {
    this._masterVolume = Math.max(0, value);
    this.applyMaster();
  }

  public get muted(): boolean {
    return this._muted;
  }

  public set muted(value: boolean) {
    this._muted = value;
    this.applyMaster();
  }

  public destroy(): void {
    if (this.target !== null) {
      for (const type of GESTURE_EVENTS) {
        this.target.removeEventListener(type, this.onGesture);
      }
    }

    if (this.doc !== null) {
      this.doc.removeEventListener("visibilitychange", this.onVisibility);
    }

    void this.ctx.close();
  }

  private applyMaster(): void {
    this.master.gain.value = this._muted ? 0 : this._masterVolume;
  }

  private async unlock(): Promise<void> {
    if (this.unlocked) {
      return;
    }

    try {
      await this.ctx.resume();
    } catch {
      return;
    }

    this.unlocked = true;
    if (this.target !== null) {
      for (const type of GESTURE_EVENTS) {
        this.target.removeEventListener(type, this.onGesture);
      }
    }
  }

  private handleVisibility(): void {
    if (this.doc === null) {
      return;
    }

    if (this.doc.hidden) {
      void this.ctx.suspend();
    } else if (this.unlocked) {
      void this.ctx.resume();
    }
  }
}
