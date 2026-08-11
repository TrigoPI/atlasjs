import type { Unsubscribe } from "@atlasjs/core";
import { Animator, AtlasScript } from "@atlasjs/gameplay";

export class RunningParticleScript extends AtlasScript {
  private animator: Animator;
  private unsubscribe: Unsubscribe;

  public onCreate(): void {
    this.animator = this.requireComponent(Animator);
    this.unsubscribe = this.animator.on("finished", () => this.destroy());
  }

  public onDestroy(): void {
    this.unsubscribe();
  }
}
