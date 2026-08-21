import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";
import { Easing } from "@atlasjs/math";

import type { AttackPhase } from "./AttackTimeline";
import type {
  WeaponAttackAudioProps,
  WeaponAttackImpactProps,
} from "./WeaponAttack";

import { TimelineAttack } from "./TimelineAttack";

type LungeAttackProps = WeaponAttackAudioProps &
  WeaponAttackImpactProps & {
    windupDuration?: number;
    extendDuration?: number;
    holdDuration?: number;
    recoverDuration?: number;
    windupAngle?: number;
    pullbackRadius?: number;
    lungeRadius?: number;
  };

export class LungeAttack extends TimelineAttack<LungeAttackProps> {
  private readonly windupDuration: number = 0.12;
  private readonly extendDuration: number = 0.06;
  private readonly holdDuration: number = 0.06;
  private readonly recoverDuration: number = 0.28;
  private readonly windupAngle: number = 0.35;
  private readonly pullbackRadius: number = 0.35;
  private readonly lungeRadius: number = 3.4;

  protected buildPhases(): AttackPhase[] {
    return [
      {
        name: "windup",
        duration: this.windupDuration,
        angleOffset: { to: -this.windupAngle, easing: Easing.inOutQuad },
        radiusScale: { to: this.pullbackRadius, easing: Easing.inOutQuad },
      },
      {
        name: "extend",
        duration: this.extendDuration,
        angleOffset: { to: 0, easing: Easing.outQuint },
        radiusScale: { to: this.lungeRadius, easing: Easing.outBack },
        cue: { sound: {} },
      },
      {
        name: "hold",
        duration: this.holdDuration,
      },
      {
        name: "recover",
        duration: this.recoverDuration,
        angleOffset: { to: 0, easing: Easing.inOutQuad },
        radiusScale: { to: 1, easing: Easing.inOutQuad },
      },
    ];
  }
}

registerScriptMetadata(LungeAttack, {
  exposed: {
    windupDuration: ScriptMetadata.field(),
    extendDuration: ScriptMetadata.field(),
    holdDuration: ScriptMetadata.field(),
    recoverDuration: ScriptMetadata.field(),
    windupAngle: ScriptMetadata.field(),
    pullbackRadius: ScriptMetadata.field(),
    lungeRadius: ScriptMetadata.field(),
  },
});
