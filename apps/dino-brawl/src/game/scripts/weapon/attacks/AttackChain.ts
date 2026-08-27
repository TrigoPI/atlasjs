import {
  type Stopwatch,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

import { type AttackPose, WeaponAttack } from "./WeaponAttack";

type AttackChainProps = {
  attacks: WeaponAttack[];
  resetDelay?: number;
};

export class AttackChain extends WeaponAttack<AttackChainProps> {
  private readonly attacks: WeaponAttack[] = [];
  private readonly resetDelay: number = 0.5;

  private currentIndex: number = 0;
  private hasPlayedStep: boolean = false;

  private sinceBegin: Stopwatch;

  public override onCreate(): void {
    super.onCreate();

    this.sinceBegin = this.stopwatch();
  }

  public get duration(): number {
    const current: WeaponAttack | undefined = this.getCurrentAttack();
    return current === undefined ? 0 : current.duration;
  }

  public override get rearmsHits(): boolean {
    const current: WeaponAttack | undefined = this.getCurrentAttack();
    return current === undefined ? false : current.rearmsHits;
  }

  public override get impactKnockback(): number | undefined {
    const current: WeaponAttack | undefined = this.getCurrentAttack();
    return current === undefined ? undefined : current.impactKnockback;
  }

  public override get impactHitstop(): number | undefined {
    const current: WeaponAttack | undefined = this.getCurrentAttack();
    return current === undefined ? undefined : current.impactHitstop;
  }

  public begin(): void {
    const next: WeaponAttack | undefined = this.selectNextAttack();

    if (next === undefined) {
      return;
    }

    this.sinceBegin.reset();
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

  public override advance(t: number): void {
    const current: WeaponAttack | undefined = this.getCurrentAttack();

    if (current === undefined) {
      return;
    }

    current.advance(t);
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
      this.sinceBegin.elapsed > resetThreshold
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
