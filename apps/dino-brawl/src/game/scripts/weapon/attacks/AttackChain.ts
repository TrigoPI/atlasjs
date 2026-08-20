import { registerScriptMetadata, ScriptMetadata } from "@atlasjs/gameplay";

import { type AttackPose, WeaponAttack } from "./WeaponAttack";

type AttackChainProps = {
  attacks: WeaponAttack[];
  resetDelay?: number;
};

export class AttackChain extends WeaponAttack<AttackChainProps> {
  private readonly attacks: WeaponAttack[] = [];
  private readonly resetDelay: number = 0.5;

  private currentIndex: number = 0;
  private elapsedSinceBegin: number = 0;
  private hasPlayedStep: boolean = false;

  public get duration(): number {
    const current: WeaponAttack | undefined = this.getCurrentAttack();
    return current === undefined ? 0 : current.duration;
  }

  public begin(): void {
    const next: WeaponAttack | undefined = this.selectNextAttack();

    if (next === undefined) {
      return;
    }

    this.elapsedSinceBegin = 0;
    this.hasPlayedStep = true;
    next.begin();
  }

  public sample(t: number, out: AttackPose): void {
    const current: WeaponAttack | undefined = this.getCurrentAttack();

    if (current === undefined) {
      return;
    }

    current.sample(t, out);
  }

  public onUpdate(dt: number): void {
    this.elapsedSinceBegin += dt;
  }

  private selectNextAttack(): WeaponAttack | undefined {
    if (this.attacks.length === 0) {
      return undefined;
    }

    if (!this.hasPlayedStep) {
      this.currentIndex = 0;
      return this.attacks[this.currentIndex];
    }

    const current: WeaponAttack = this.attacks[this.currentIndex];
    const resetThreshold: number = current.duration + this.resetDelay;

    this.currentIndex =
      this.elapsedSinceBegin > resetThreshold
        ? 0
        : (this.currentIndex + 1) % this.attacks.length;

    return this.attacks[this.currentIndex];
  }

  private getCurrentAttack(): WeaponAttack | undefined {
    return this.attacks[this.currentIndex];
  }
}

registerScriptMetadata(AttackChain, {
  exposed: {
    attacks: ScriptMetadata.field({ required: true }),
    resetDelay: ScriptMetadata.field(),
  },
});
