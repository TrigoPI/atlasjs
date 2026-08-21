import { Easing, MathUtils } from "@atlasjs/math";

import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";

import {
  type AttackPose,
  type WeaponAttackAudioProps,
  WeaponAttack,
} from "./WeaponAttack";

type SwingAttackProps = WeaponAttackAudioProps & {
  strikeDuration?: number;
  recoverDuration?: number;
  windupAngle?: number;
  strikeAngle?: number;
};

export class SwingAttack extends WeaponAttack<SwingAttackProps> {
  private readonly strikeDuration: number = 0.09;
  private readonly recoverDuration: number = 0.18;
  private readonly windupAngle: number = Math.PI * 0.3;
  private readonly strikeAngle: number = Math.PI * 0.55;

  public get duration(): number {
    return this.strikeDuration + this.recoverDuration;
  }

  public begin(): void {
    this.playClip();
  }

  // prettier-ignore
  public sample(t: number, out: AttackPose): void {
    const strikeTime: number = t;

    if (strikeTime < this.strikeDuration) {
      const eased: number = Easing.outCubic(strikeTime / this.strikeDuration);
      out.angleOffset = MathUtils.lerp(this.windupAngle, -this.strikeAngle, eased);
      out.radiusScale = 1;
      out.scale = 1;
      return;
    }

    const recoverTime: number = strikeTime - this.strikeDuration;
    const p: number = MathUtils.clamp(recoverTime / this.recoverDuration, 0, 1);
    const eased: number = Easing.inOutQuad(p);

    out.angleOffset = MathUtils.lerp(-this.strikeAngle, 0, eased);
    out.radiusScale = 1;
    out.scale = 1;
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
