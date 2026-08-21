/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { AttackPose } from "./AttackPose";
import type { AttackPhase } from "./AttackTimeline";
import { AttackTimeline } from "./AttackTimeline";
import { WeaponAttack } from "./WeaponAttack";

export abstract class TimelineAttack<
  TProps extends object = {},
> extends WeaponAttack<TProps> {
  private timeline?: AttackTimeline;

  public get duration(): number {
    return this.getTimeline().duration;
  }

  public sample(t: number, out: AttackPose): void {
    this.getTimeline().sample(t, out);
  }

  protected abstract buildPhases(): AttackPhase[];

  private getTimeline(): AttackTimeline {
    if (this.timeline === undefined) {
      this.timeline = new AttackTimeline(this.buildPhases());
    }

    return this.timeline;
  }
}
