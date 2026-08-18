import { Easing, MathUtils, PI_2 } from "@atlasjs/math";

import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";

import {
  type AttackPose,
  type WeaponAttackAudioProps,
  WeaponAttack,
} from "./WeaponAttack";

type SpinAttackProps = WeaponAttackAudioProps & {
  windupDuration?: number;
  spinDuration?: number;
  recoverDuration?: number;
  windupAngle?: number;
  spinRadius?: number;
  spinScale?: number;
  revolutions?: number;
};

export class SpinAttack extends WeaponAttack<SpinAttackProps> {
  private readonly windupDuration: number = 0.16;
  private readonly spinDuration: number = 0.26;
  private readonly recoverDuration: number = 0.14;
  private readonly windupAngle: number = 0.4;
  private readonly spinRadius: number = 1.3;
  private readonly spinScale: number = 1.2;
  private readonly revolutions: number = 1;

  public get duration(): number {
    return this.windupDuration + this.spinDuration + this.recoverDuration;
  }

  public get impactTime(): number {
    return this.windupDuration + this.spinDuration * 0.5;
  }

  public begin(): void {
    this.playClip();
  }

  // prettier-ignore
  public sample(t: number, out: AttackPose): void {
    const windupTime: number = t;

    if (windupTime < this.windupDuration) {
      const eased: number = Easing.inOutQuad(windupTime / this.windupDuration);
      out.angleOffset = MathUtils.lerp(0, -this.windupAngle, eased);
      out.radiusScale = 1;
      out.scale = 1;
      return;
    }

    const spinTime: number = windupTime - this.windupDuration;
    const finalAngleOffset: number = PI_2 * this.revolutions;

    if (spinTime < this.spinDuration) {
      const eased: number = Easing.outCubic(spinTime / this.spinDuration);
      out.angleOffset = MathUtils.lerp(-this.windupAngle, finalAngleOffset, eased);
      out.radiusScale = MathUtils.lerp(1, this.spinRadius, eased);
      out.scale = MathUtils.lerp(1, this.spinScale, eased);
      return;
    }

    const recoverTime: number = spinTime - this.spinDuration;
    const p: number = MathUtils.clamp(recoverTime / this.recoverDuration, 0, 1);
    const eased: number = Easing.inOutQuad(p);

    out.angleOffset = finalAngleOffset;
    out.radiusScale = MathUtils.lerp(this.spinRadius, 1, eased);
    out.scale = MathUtils.lerp(this.spinScale, 1, eased);
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
