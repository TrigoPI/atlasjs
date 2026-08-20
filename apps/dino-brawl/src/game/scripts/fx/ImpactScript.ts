import type { Unsubscribe } from "@atlasjs/core";
import { randomRange } from "@atlasjs/utils";
import { Animator, AtlasScript, Transform } from "@atlasjs/gameplay";

/** A one-shot burst: it varies a little, then takes itself off screen. */
export class ImpactScript extends AtlasScript<{ scale?: number }> {
  private readonly scale: number = 1;

  private animator: Animator;
  private unsubscribe: Unsubscribe;

  public onCreate(): void {
    const jitter: number = randomRange(0.85, 1.15);
    const transform: Transform = this.requireComponent(Transform);

    transform.scale.set(this.scale * jitter, this.scale * jitter);

    this.animator = this.requireComponent(Animator);
    this.unsubscribe = this.animator.on("finished", () => this.destroy());
  }

  public onDestroy(): void {
    this.unsubscribe();
  }
}
