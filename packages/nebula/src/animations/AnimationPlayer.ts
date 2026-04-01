import { Sprite } from "../graphics";
import { SpriteAnimation } from "./SpriteAnimation";

export class AnimationPlayer {
  private readonly animations: Map<string, SpriteAnimation>;

  private currentAnimationName?: string;
  private currentAnimation?: SpriteAnimation;

  public constructor() {
    this.animations = new Map<string, SpriteAnimation>();
  }

  public setDefault(name: string): this {
    if (!this.animations.has(name)) {
      throw new Error(`Animation '${name}' not found.`);
    }

    this.currentAnimationName = name;
    this.currentAnimation = this.animations.get(name);

    return this;
  }

  public add(name: string, animation: SpriteAnimation): this {
    if (this.animations.has(name)) {
      throw new Error(`Animation '${name}' already exists.`);
    }

    this.animations.set(name, animation);
    return this;
  }

  public has(name: string): boolean {
    return this.animations.has(name);
  }

  public get(name: string): SpriteAnimation {
    const animation: SpriteAnimation | undefined = this.animations.get(name);

    if (!animation) {
      throw new Error(`Animation '${name}' not found.`);
    }

    return animation;
  }

  public play(name: string, restart: boolean = false): void {
    const nextAnimation: SpriteAnimation | undefined = this.get(name);

    if (this.currentAnimationName === name) {
      if (restart) {
        nextAnimation.stop();
        nextAnimation.play();
      }

      return;
    }

    if (this.currentAnimation) {
      this.currentAnimation.stop();
    }

    this.currentAnimationName = name;
    this.currentAnimation = nextAnimation;

    if (restart) {
      this.currentAnimation.stop();
    }

    this.currentAnimation.play();
  }

  public updateAndApply(sprite: Sprite): void {
    this.currentAnimation?.updateAndApply(sprite);
  }

  public pause(): void {
    this.currentAnimation?.pause();
  }

  public resume(): void {
    this.currentAnimation?.resume();
  }

  public stop(): void {
    this.currentAnimation?.stop();
  }

  public getCurrentAnimationName(): string | undefined {
    return this.currentAnimationName;
  }

  public getCurrentAnimation(): SpriteAnimation | undefined {
    return this.currentAnimation;
  }

  public isPlaying(): boolean {
    return this.currentAnimation?.isPlaying() ?? false;
  }
}
