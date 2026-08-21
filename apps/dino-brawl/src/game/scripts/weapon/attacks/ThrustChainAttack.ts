import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";
import { Easing } from "@atlasjs/math";

import type { AttackPhase } from "./AttackTimeline";
import type {
  WeaponAttackAudioProps,
  WeaponAttackImpactProps,
} from "./WeaponAttack";

import { TimelineAttack } from "./TimelineAttack";

type ThrustChainAttackProps = WeaponAttackAudioProps &
  WeaponAttackImpactProps & {
    thrustCount?: number;
    thrustDuration?: number;
    holdDuration?: number;
    recoverDuration?: number;
    pullbackRadius?: number;
    thrustRadius?: number;
    pitchStep?: number;
    radiusStep?: number;
  };

export class ThrustChainAttack extends TimelineAttack<ThrustChainAttackProps> {
  private readonly thrustCount: number = 3;
  private readonly thrustDuration: number = 0.07;
  private readonly holdDuration: number = 0.05;
  private readonly recoverDuration: number = 0.2;
  private readonly pullbackRadius: number = 0.55;
  private readonly thrustRadius: number = 1.85;
  private readonly pitchStep: number = 0.08;
  private readonly radiusStep: number = 0;

  protected buildPhases(): AttackPhase[] {
    const phases: AttackPhase[] = [];

    for (let index: number = 0; index < this.thrustCount; index += 1) {
      const radius: number = this.thrustRadius + index * this.radiusStep;

      phases.push({
        name: "thrust",
        duration: this.thrustDuration,
        radiusScale: {
          from: this.pullbackRadius,
          to: radius,
          easing: Easing.outQuint,
        },
        cue: {
          sound: { pitch: this.pitch + index * this.pitchStep },
          rearmHits: true,
        },
      });

      phases.push({
        name: "hold",
        duration: this.holdDuration,
        radiusScale: {
          from: radius,
          to: this.pullbackRadius,
          easing: Easing.outCubic,
        },
      });
    }

    phases.push({
      name: "recover",
      duration: this.recoverDuration,
      radiusScale: { to: 1, easing: Easing.inOutQuad },
    });

    return phases;
  }
}

registerScriptMetadata(ThrustChainAttack, {
  exposed: {
    thrustCount: ScriptMetadata.field(),
    thrustDuration: ScriptMetadata.field(),
    holdDuration: ScriptMetadata.field(),
    recoverDuration: ScriptMetadata.field(),
    pullbackRadius: ScriptMetadata.field(),
    thrustRadius: ScriptMetadata.field(),
    pitchStep: ScriptMetadata.field(),
    radiusStep: ScriptMetadata.field(),
  },
});
