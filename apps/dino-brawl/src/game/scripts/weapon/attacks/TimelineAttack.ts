/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { AttackPose } from "./AttackPose";
import type { AttackCue, AttackPhase } from "./AttackTimeline";
import { AttackTimeline } from "./AttackTimeline";
import { WeaponAttack } from "./WeaponAttack";

export abstract class TimelineAttack<
  TProps extends object = {},
> extends WeaponAttack<TProps> {
  private readonly cues: AttackCue[] = [];

  private timeline?: AttackTimeline;
  private cursor: number = -1;
  private rearm: boolean = false;

  public get duration(): number {
    return this.getTimeline().duration;
  }

  public override get rearmsHits(): boolean {
    return this.rearm;
  }

  public override begin(): void {
    this.cursor = -1;
    this.rearm = false;
    super.begin();
  }

  public override advance(t: number): void {
    this.cues.length = 0;
    this.rearm = false;

    if (t <= this.cursor) {
      return;
    }

    this.getTimeline().collectCues(this.cursor, t, this.cues);
    this.cursor = t;

    for (let index: number = 0; index < this.cues.length; index += 1) {
      this.fireCue(this.cues[index]);
    }
  }

  public sample(t: number, out: AttackPose): void {
    this.getTimeline().sample(t, out);
  }

  protected abstract buildPhases(): AttackPhase[];

  protected override playsClipOnBegin(): boolean {
    return !this.getTimeline().hasSoundCue;
  }

  private fireCue(cue: AttackCue): void {
    if (cue.rearmHits === true) {
      this.rearm = true;
    }

    if (cue.sound === undefined) {
      return;
    }

    this.playClip(cue.sound.clip, cue.sound.pitch, cue.sound.volume);
  }

  private getTimeline(): AttackTimeline {
    if (this.timeline === undefined) {
      this.timeline = new AttackTimeline(this.buildPhases());
    }

    return this.timeline;
  }
}
