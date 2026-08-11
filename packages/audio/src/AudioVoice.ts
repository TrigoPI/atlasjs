export interface AudioVoice {
  readonly finished: boolean;
  apply(volume: number, muted: boolean, pitch: number): void;
  stop(): void;
}
