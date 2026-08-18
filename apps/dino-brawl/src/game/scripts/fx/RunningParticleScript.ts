import type { Unsubscribe } from "@atlasjs/core";
import { randomRange } from "@atlasjs/utils";
import { Animator, AtlasScript, Transform } from "@atlasjs/gameplay";

export class RunningParticleScript extends AtlasScript {
  private animator: Animator;
  private transform: Transform;

  private unsubscribe: Unsubscribe;

  public onCreate(): void {
    const scale: number = randomRange(2, 2.9);

    this.animator = this.requireComponent(Animator);
    this.transform = this.requireComponent(Transform);
    this.transform.scale.set(scale, scale);

    this.unsubscribe = this.animator.on("finished", () => this.onFinished());
  }

  public onDestroy(): void {
    this.unsubscribe();
  }

  private onFinished(): void {
    this.destroy();
  }
}
