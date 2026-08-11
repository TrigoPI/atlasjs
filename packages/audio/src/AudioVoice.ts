export interface AudioVoice {
  readonly finished: boolean;
  apply(volume: number, muted: boolean): void;
  stop(): void;
}
