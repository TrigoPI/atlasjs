import { Easing, MathUtils } from "@atlasjs/math";

import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";

import {
  type AttackPose,
  type WeaponAttackAudioProps,
  WeaponAttack,
} from "./WeaponAttack";

type SwingAttackProps = WeaponAttackAudioProps & {
  windupDuration?: number;
  strikeDuration?: number;
  recoverDuration?: number;
  windupAngle?: number;
  strikeAngle?: number;
  strikeScale?: number;
};

export class SwingAttack extends WeaponAttack<SwingAttackProps> {
  private readonly windupDuration: number = 0.3;
  private readonly strikeDuration: number = 0.09;
  private readonly recoverDuration: number = 0.18;
  private readonly windupAngle: number = Math.PI * 0.3;
  private readonly strikeAngle: number = Math.PI * 0.55;
  private readonly strikeScale: number = 1.5;

  public get duration(): number {
    return this.windupDuration + this.strikeDuration + this.recoverDuration;
  }

  public get impactTime(): number {
    return this.windupDuration + this.strikeDuration * 0.5;
  }

  public begin(): void {
    this.playClip();
  }

  // prettier-ignore
  public sample(t: number, out: AttackPose): void {
    const windupTime: number = t;

    if (windupTime < this.windupDuration) {
      const eased: number = Easing.inOutQuad(windupTime / this.windupDuration);
      out.angleOffset = MathUtils.lerp(0, this.windupAngle, eased);
      out.radiusScale = 1;
      out.scale = 1;
      return;
    }

    const strikeTime: number = windupTime - this.windupDuration;

    if (strikeTime < this.strikeDuration) {
      const eased: number = Easing.outCubic(strikeTime / this.strikeDuration);
      out.angleOffset = MathUtils.lerp(this.windupAngle, -this.strikeAngle, eased);
      out.radiusScale = 1;
      out.scale = MathUtils.lerp(1, this.strikeScale, eased);
      return;
    }

    const recoverTime: number = strikeTime - this.strikeDuration;
    const p: number = MathUtils.clamp(recoverTime / this.recoverDuration, 0, 1);
    const eased: number = Easing.inOutQuad(p);

    out.angleOffset = MathUtils.lerp(-this.strikeAngle, 0, eased);
    out.radiusScale = 1;
    out.scale = MathUtils.lerp(this.strikeScale, 1, eased);
  }
}

registerScriptMetadata(SwingAttack, {
  exposed: {
    windupDuration: ScriptMetadata.field(),
    strikeDuration: ScriptMetadata.field(),
    recoverDuration: ScriptMetadata.field(),
    windupAngle: ScriptMetadata.field(),
    strikeAngle: ScriptMetadata.field(),
    strikeScale: ScriptMetadata.field(),
  },
});
