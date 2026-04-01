import { Clock } from "@atlasjs/utils";

import { SpriteAnimationOptions } from "./animation-types";
import { Sprite } from "../graphics";

import { Frame } from "./Frame";

export class SpriteAnimation {
  private readonly frames: Frame[];
  private readonly frameDuration: number;
  private readonly clock: Clock;
  private readonly loop: boolean;

  private lastFrameIndex: number;
  private currentFrameIndex: number;
  private playing: boolean;

  public constructor(options: SpriteAnimationOptions) {
    if (options.frames.length === 0) {
      throw new Error("SpriteAnimation requires at least one frame.");
    }

    if (options.fps <= 0) {
      throw new Error("SpriteAnimation fps must be greater than 0.");
    }

    this.clock = new Clock();
    this.frames = options.frames;

    this.currentFrameIndex = 0;
    this.lastFrameIndex = 0;

    this.frameDuration = 1000 / options.fps;
    this.playing = options.autoPlay ?? false;
    this.loop = options.loop ?? false;
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
    if (!this.playing) {
      this.playing = true;
      this.clock.reset();
    }
  }

  public pause(): void {
    if (this.playing) {
      this.playing = false;
      this.clock.pause();
    }
  }

  public resume(): void {
    if (!this.playing) {
      this.playing = true;
      this.clock.resume();
    }
  }

  public stop(): void {
    if (this.playing) {
      this.currentFrameIndex = 0;
      this.playing = false;
      this.clock.reset();
    }
  }

  public updateAndApply(sprite: Sprite): void {
    this.update();
    this.apply(sprite);
  }

  private getFrameIndex(): number {
    const elapsed: number = this.clock.getTimeMilliseconds();
    const index: number = Math.floor(elapsed / this.frameDuration);

    if (!this.loop) {
      return Math.min(index, this.frames.length - 1);
    }

    return index % this.frames.length;
  }

  private update(): void {
    if (!this.playing) return;

    const index: number = this.getFrameIndex();
    this.currentFrameIndex = index;

    if (this.currentFrameIndex !== this.lastFrameIndex) {
      // event / callback plus tard
    }

    if (!this.loop && index === this.frames.length - 1) {
      this.playing = false;
    }
  }

  private apply(sprite: Sprite): void {
    const frame: Frame = this.frames[this.currentFrameIndex];
    sprite.setFrame(frame);
  }
}
