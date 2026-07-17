import { AnimationPlayer, Frame, SpriteAnimation } from "@atlasjs/nebula";

export class Animator {
  private readonly player: AnimationPlayer;

  public constructor(clips: Record<string, SpriteAnimation>, initial?: string) {
    this.player = new AnimationPlayer();

    for (const name of Object.keys(clips)) {
      this.player.add(name, clips[name]);
    }

    if (initial !== undefined) {
      this.player.play(initial);
    }
  }

  public play(name: string): this {
    this.player.play(name);
    return this;
  }

  public stop(): this {
    this.player.stop();
    return this;
  }

  public get playing(): string | null {
    return this.player.getCurrentAnimationName() ?? null;
  }

  public currentFrame(): Frame | null {
    return this.player.getCurrentFrame() ?? null;
  }

  public tick(deltaMs: number): void {
    this.player.tick(deltaMs);
  }
}
