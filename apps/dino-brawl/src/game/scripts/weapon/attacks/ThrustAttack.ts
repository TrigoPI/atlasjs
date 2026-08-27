import { Easing } from "@atlasjs/math";

import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";

import type { AttackPhase } from "./AttackTimeline";
import { TimelineAttack } from "./TimelineAttack";
import type {
  WeaponAttackAudioProps,
  WeaponAttackImpactProps,
} from "./WeaponAttack";

type ThrustAttackProps = WeaponAttackAudioProps &
  WeaponAttackImpactProps & {
    thrustDuration?: number;
    holdDuration?: number;
    recoverDuration?: number;
    pullbackRadius?: number;
    thrustRadius?: number;
  };

export class ThrustAttack extends TimelineAttack<ThrustAttackProps> {
  private readonly thrustDuration: number = 0.07;
  private readonly holdDuration: number = 0.05;
  private readonly recoverDuration: number = 0.2;
  private readonly pullbackRadius: number = 0.55;
  private readonly thrustRadius: number = 1.85;

  protected buildPhases(): AttackPhase[] {
    return [
      {
        name: "thrust",
        duration: this.thrustDuration,
        radiusScale: {
          from: this.pullbackRadius,
          to: this.thrustRadius,
          easing: Easing.outCubic,
        },
      },
      {
        name: "hold",
        duration: this.holdDuration,
      },
      {
        name: "recover",
        duration: this.recoverDuration,
        radiusScale: { to: 1, easing: Easing.inOutQuad },
      },
    ];
  }
}

registerScriptMetadata(ThrustAttack, {
  exposed: {
    thrustDuration: ScriptMetadata.field(),
    holdDuration: ScriptMetadata.field(),
    recoverDuration: ScriptMetadata.field(),
    pullbackRadius: ScriptMetadata.field(),
    thrustRadius: ScriptMetadata.field(),
  },
});
