import { SpriteAnimationOptions } from "./animation-types";
import { SpriteNode } from "../graphics";

import { Frame } from "./Frame";

export class SpriteAnimation {
  private readonly frames: Frame[];
  private readonly frameDuration: number;
  private readonly loop: boolean;

  private currentFrameIndex: number;
  private playing: boolean;
  private elapsedMs: number;

  public constructor(options: SpriteAnimationOptions) {
    if (options.frames.length === 0) {
      throw new Error("SpriteAnimation requires at least one frame.");
    }

    if (options.fps <= 0) {
      throw new Error("SpriteAnimation fps must be greater than 0.");
    }

    this.frames = options.frames;
    this.currentFrameIndex = 0;
    this.frameDuration = 1000 / options.fps;
    this.playing = options.autoPlay ?? false;
    this.loop = options.loop ?? false;
    this.elapsedMs = 0;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public getCurrentFrame(): Frame {
    return this.frames[this.currentFrameIndex];
  }

  public getDuration(): number {
    return this.frames.length * this.frameDuration;
  }

  public getCurrentFrameIndex(): number {
    return this.currentFrameIndex;
  }

  public play(): void {
    this.playing = true;
    this.elapsedMs = 0;
    this.currentFrameIndex = 0;
  }

  public pause(): void {
    this.playing = false;
  }

  public resume(): void {
    this.playing = true;
  }

  public stop(): void {
    this.playing = false;
    this.elapsedMs = 0;
    this.currentFrameIndex = 0;
  }

  public tick(deltaMs: number): void {
    if (!this.playing) return;

    this.elapsedMs += deltaMs;
    this.currentFrameIndex = this.computeIndex();

    if (!this.loop && this.currentFrameIndex === this.frames.length - 1) {
      this.playing = false;
    }
  }

  public updateAndApply(sprite: SpriteNode, deltaMs: number): void {
    this.tick(deltaMs);
    sprite.setFrame(this.frames[this.currentFrameIndex]);
  }

  private computeIndex(): number {
    const index: number = Math.floor(this.elapsedMs / this.frameDuration);

    if (!this.loop) {
      return Math.min(index, this.frames.length - 1);
    }

    return index % this.frames.length;
  }
}
