import { EventBus, Unsubscribe } from "@atlasjs/core";
import { AnimationPlayer, Frame, SpriteAnimation } from "@atlasjs/nebula";

export type AnimatorEvents = {
  started: string;
  finished: string;
  loop: string;
};

export class Animator {
  private readonly player: AnimationPlayer;
  private readonly events: EventBus<AnimatorEvents>;

  public constructor(clips: Record<string, SpriteAnimation>, initial?: string) {
    this.player = new AnimationPlayer();
    this.events = new EventBus<AnimatorEvents>();

    for (const name of Object.keys(clips)) {
      this.player.add(name, clips[name]);
    }

    if (initial !== undefined) {
      this.player.play(initial);
    }
  }

  /**
   * Switches clip. Playing the clip already running is a no-op unless
   * `restart` is set, which replays it from its first frame.
   */
  public play(name: string, restart: boolean = false): this {
    const previous: string | null =
      this.player.getCurrentAnimationName() ?? null;
    this.player.play(name, restart);
    const current: string | null =
      this.player.getCurrentAnimationName() ?? null;

    if (current !== null && (current !== previous || restart)) {
      this.events.emit("started", current);
    }

    return this;
  }

  public stop(): this {
    this.player.stop();
    return this;
  }

  /** Holds the current frame; the clip resumes where it left off. */
  public pause(): this {
    this.player.pause();
    return this;
  }

  public resume(): this {
    this.player.resume();
    return this;
  }

  public on<K extends keyof AnimatorEvents>(
    event: K,
    cb: (clip: string) => void,
  ): Unsubscribe {
    return this.events.on(event, cb);
  }

  public off<K extends keyof AnimatorEvents>(
    event: K,
    cb: (clip: string) => void,
  ): void {
    this.events.off(event, cb);
  }

  public get playing(): string | null {
    return this.player.getCurrentAnimationName() ?? null;
  }

  public currentFrame(): Frame | null {
    return this.player.getCurrentFrame() ?? null;
  }

  public tick(deltaMs: number): void {
    const name: string | null = this.player.getCurrentAnimationName() ?? null;
    const animation: SpriteAnimation | undefined =
      this.player.getCurrentAnimation();

    if (name === null || animation === undefined) {
      this.player.tick(deltaMs);
      return;
    }

    const wasPlaying: boolean = animation.isPlaying();
    const prevIndex: number = animation.getCurrentFrameIndex();

    this.player.tick(deltaMs);

    const nowPlaying: boolean = animation.isPlaying();
    const nowIndex: number = animation.getCurrentFrameIndex();

    if (wasPlaying && !nowPlaying) {
      this.events.emit("finished", name);
    } else if (nowPlaying && nowIndex < prevIndex) {
      this.events.emit("loop", name);
    }
  }
}
