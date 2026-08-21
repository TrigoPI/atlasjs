import { Easing } from "@atlasjs/math";

import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";

import type { AttackPhase } from "./AttackTimeline";
import { TimelineAttack } from "./TimelineAttack";
import type { WeaponAttackAudioProps } from "./WeaponAttack";

type SwingAttackProps = WeaponAttackAudioProps & {
  strikeDuration?: number;
  recoverDuration?: number;
  windupAngle?: number;
  strikeAngle?: number;
};

export class SwingAttack extends TimelineAttack<SwingAttackProps> {
  private readonly strikeDuration: number = 0.09;
  private readonly recoverDuration: number = 0.18;
  private readonly windupAngle: number = Math.PI * 0.3;
  private readonly strikeAngle: number = Math.PI * 0.55;

  protected buildPhases(): AttackPhase[] {
    return [
      {
        name: "strike",
        duration: this.strikeDuration,
        angleOffset: {
          from: this.windupAngle,
          to: -this.strikeAngle,
          easing: Easing.outCubic,
        },
      },
      {
        name: "recover",
        duration: this.recoverDuration,
        angleOffset: { to: 0, easing: Easing.inOutQuad },
      },
    ];
  }
}

registerScriptMetadata(SwingAttack, {
  exposed: {
    strikeDuration: ScriptMetadata.field(),
    recoverDuration: ScriptMetadata.field(),
    windupAngle: ScriptMetadata.field(),
    strikeAngle: ScriptMetadata.field(),
  },
});
