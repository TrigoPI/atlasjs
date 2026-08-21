import { Easing, MathUtils } from "@atlasjs/math";

import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";

import {
  type AttackPose,
  type WeaponAttackAudioProps,
  WeaponAttack,
} from "./WeaponAttack";

type ThrustAttackProps = WeaponAttackAudioProps & {
  pullbackDuration?: number;
  thrustDuration?: number;
  holdDuration?: number;
  recoverDuration?: number;
  pullbackRadius?: number;
  thrustRadius?: number;
};

export class ThrustAttack extends WeaponAttack<ThrustAttackProps> {
  private readonly thrustDuration: number = 0.07;
  private readonly holdDuration: number = 0.05;
  private readonly recoverDuration: number = 0.2;
  private readonly pullbackRadius: number = 0.55;
  private readonly thrustRadius: number = 1.85;

  public get duration(): number {
    return this.thrustDuration + this.holdDuration + this.recoverDuration;
  }

  public begin(): void {
    this.playClip();
  }

  // prettier-ignore
  public sample(t: number, out: AttackPose): void {
    out.angleOffset = 0;
    out.scale = 1;

    const thrustTime: number = t;

    if (thrustTime < this.thrustDuration) {
      const eased: number = Easing.outCubic(thrustTime / this.thrustDuration);
      out.radiusScale = MathUtils.lerp(this.pullbackRadius, this.thrustRadius, eased);
      return;
    }

    const holdTime: number = thrustTime - this.thrustDuration;

    if (holdTime < this.holdDuration) {
      out.radiusScale = this.thrustRadius;
      return;
    }

    const recoverTime: number = holdTime - this.holdDuration;
    const p: number = MathUtils.clamp(recoverTime / this.recoverDuration, 0, 1);
    const eased: number = Easing.inOutQuad(p);

    out.radiusScale = MathUtils.lerp(this.thrustRadius, 1, eased);
  }
}

registerScriptMetadata(ThrustAttack, {
  exposed: {
    pullbackDuration: ScriptMetadata.field(),
    thrustDuration: ScriptMetadata.field(),
    holdDuration: ScriptMetadata.field(),
    recoverDuration: ScriptMetadata.field(),
    pullbackRadius: ScriptMetadata.field(),
    thrustRadius: ScriptMetadata.field(),
  },
});
