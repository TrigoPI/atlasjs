import { MathUtils } from "@atlasjs/math";

import type { AudioClip } from "@atlasjs/audio";
import type { AttackPose } from "./AttackPose";

export type AttackTween = {
  from?: number;
  to: number;
  easing?: (t: number) => number;
};

export type AttackCueSound = {
  clip?: AudioClip;
  pitch?: number;
  volume?: number;
};

export type AttackCue = {
  sound?: AttackCueSound;
  rearmHits?: boolean;
};

export type AttackPhase = {
  name: string;
  duration: number;
  angleOffset?: AttackTween;
  radiusScale?: AttackTween;
  scale?: AttackTween;
  cue?: AttackCue;
};

type ResolvedChannel = {
  from: number;
  to: number;
  easing: (t: number) => number;
};

type ResolvedPhase = {
  start: number;
  duration: number;
  angleOffset: ResolvedChannel;
  radiusScale: ResolvedChannel;
  scale: ResolvedChannel;
  cue?: AttackCue;
};

const IDENTITY_ANGLE_OFFSET: number = 0;
const IDENTITY_RADIUS_SCALE: number = 1;
const IDENTITY_SCALE: number = 1;

function linear(t: number): number {
  return t;
}

function resolveChannel(
  tween: AttackTween | undefined,
  carried: number,
): ResolvedChannel {
  if (tween === undefined) {
    return { from: carried, to: carried, easing: linear };
  }

  return {
    from: tween.from ?? carried,
    to: tween.to,
    easing: tween.easing ?? linear,
  };
}

function evaluate(channel: ResolvedChannel, progress: number): number {
  const eased: number = channel.easing(progress);
  return MathUtils.lerp(channel.from, channel.to, eased);
}

export class AttackTimeline {
  private readonly phases: readonly ResolvedPhase[];
  private readonly totalDuration: number;
  private readonly soundCuePresent: boolean;

  public constructor(phases: readonly AttackPhase[]) {
    const resolved: ResolvedPhase[] = [];

    let carriedAngleOffset: number = IDENTITY_ANGLE_OFFSET;
    let carriedRadiusScale: number = IDENTITY_RADIUS_SCALE;
    let carriedScale: number = IDENTITY_SCALE;
    let elapsed: number = 0;
    let soundCue: boolean = false;

    for (let index: number = 0; index < phases.length; index += 1) {
      const phase: AttackPhase = phases[index];
      const angleOffset: ResolvedChannel = resolveChannel(
        phase.angleOffset,
        carriedAngleOffset,
      );
      const radiusScale: ResolvedChannel = resolveChannel(
        phase.radiusScale,
        carriedRadiusScale,
      );
      const scale: ResolvedChannel = resolveChannel(phase.scale, carriedScale);

      carriedAngleOffset = angleOffset.to;
      carriedRadiusScale = radiusScale.to;
      carriedScale = scale.to;

      resolved.push({
        start: elapsed,
        duration: phase.duration,
        angleOffset,
        radiusScale,
        scale,
        cue: phase.cue,
      });

      if (phase.cue?.sound !== undefined) {
        soundCue = true;
      }

      elapsed += phase.duration;
    }

    this.phases = resolved;
    this.totalDuration = elapsed;
    this.soundCuePresent = soundCue;
  }

  public get duration(): number {
    return this.totalDuration;
  }

  public get hasSoundCue(): boolean {
    return this.soundCuePresent;
  }

  public collectCues(fromT: number, toT: number, out: AttackCue[]): void {
    for (let index: number = 0; index < this.phases.length; index += 1) {
      const phase: ResolvedPhase = this.phases[index];

      if (phase.cue === undefined) {
        continue;
      }

      if (phase.start > fromT && phase.start <= toT) {
        out.push(phase.cue);
      }
    }
  }

  public sample(t: number, out: AttackPose): void {
    const count: number = this.phases.length;

    if (count === 0) {
      out.angleOffset = IDENTITY_ANGLE_OFFSET;
      out.radiusScale = IDENTITY_RADIUS_SCALE;
      out.scale = IDENTITY_SCALE;
      return;
    }

    let phase: ResolvedPhase = this.phases[count - 1];
    let progress: number = 1;

    if (t <= 0) {
      phase = this.phases[0];
      progress = 0;
    } else if (t < this.totalDuration) {
      for (let index: number = 0; index < count; index += 1) {
        const candidate: ResolvedPhase = this.phases[index];

        if (t < candidate.start + candidate.duration) {
          phase = candidate;
          break;
        }
      }

      progress =
        phase.duration > 0
          ? MathUtils.clamp((t - phase.start) / phase.duration, 0, 1)
          : 1;
    }

    out.angleOffset = evaluate(phase.angleOffset, progress);
    out.radiusScale = evaluate(phase.radiusScale, progress);
    out.scale = evaluate(phase.scale, progress);
  }
}
