import { Easing, PI_2 } from "@atlasjs/math";

import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";

import type { AttackPhase } from "./AttackTimeline";
import { TimelineAttack } from "./TimelineAttack";
import type { WeaponAttackAudioProps } from "./WeaponAttack";

type SpinAttackProps = WeaponAttackAudioProps & {
  windupDuration?: number;
  spinDuration?: number;
  recoverDuration?: number;
  windupAngle?: number;
  spinRadius?: number;
  spinScale?: number;
  revolutions?: number;
};

export class SpinAttack extends TimelineAttack<SpinAttackProps> {
  private readonly windupDuration: number = 0.16;
  private readonly spinDuration: number = 0.26;
  private readonly recoverDuration: number = 0.14;
  private readonly windupAngle: number = 0.4;
  private readonly spinRadius: number = 1.3;
  private readonly spinScale: number = 1.2;
  private readonly revolutions: number = 1;

  protected buildPhases(): AttackPhase[] {
    return [
      {
        name: "windup",
        duration: this.windupDuration,
        angleOffset: { to: -this.windupAngle, easing: Easing.inOutQuad },
      },
      {
        name: "spin",
        duration: this.spinDuration,
        angleOffset: { to: PI_2 * this.revolutions, easing: Easing.outCubic },
        radiusScale: { to: this.spinRadius, easing: Easing.outCubic },
        scale: { to: this.spinScale, easing: Easing.outCubic },
      },
      {
        name: "recover",
        duration: this.recoverDuration,
        radiusScale: { to: 1, easing: Easing.inOutQuad },
        scale: { to: 1, easing: Easing.inOutQuad },
      },
    ];
  }
}

registerScriptMetadata(SpinAttack, {
  exposed: {
    windupDuration: ScriptMetadata.field(),
    spinDuration: ScriptMetadata.field(),
    recoverDuration: ScriptMetadata.field(),
    windupAngle: ScriptMetadata.field(),
    spinRadius: ScriptMetadata.field(),
    spinScale: ScriptMetadata.field(),
    revolutions: ScriptMetadata.field(),
  },
});
