import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

export type HitInfo = {
  direction: Vec2;
  knockback?: number;
  /** Seconds both the attacker and the victim hold still on impact. */
  hitstop?: number;
};

type HurtboxScriptProps = {
  invincibilityDuration?: number;
};

export class HurtboxScript extends AtlasScript<HurtboxScriptProps> {
  /**
   * Opt-in: 0 means every blow that reaches this hurtbox lands. Weapons
   * already strike a given target at most once per attack, so this exists
   * for targets that should also shrug off *other* blows for a moment.
   */
  private readonly invincibilityDuration: number = 0;

  private readonly lastDirection: Vec2 = new Vec2();

  private invincibilityRemaining: number = 0;
  private lastKnockback: number = 0;
  private lastHitstop: number = 0;
  private hits: number = 0;

  public get isInvincible(): boolean {
    return this.invincibilityRemaining > 0;
  }

  /** Monotonic; changes exactly once per landed blow. */
  public get hitCount(): number {
    return this.hits;
  }

  public get hitDirection(): Vec2 {
    return this.lastDirection;
  }

  public get hitKnockback(): number {
    return this.lastKnockback;
  }

  public get hitHitstop(): number {
    return this.lastHitstop;
  }

  public onUpdate(dt: number): void {
    if (this.invincibilityRemaining <= 0) {
      return;
    }

    this.invincibilityRemaining -= dt;
  }

  public takeHit(hit: HitInfo): boolean {
    if (this.invincibilityRemaining > 0) {
      return false;
    }

    this.invincibilityRemaining = this.invincibilityDuration;

    this.lastDirection.copyFrom(hit.direction).normalize();
    this.lastKnockback = hit.knockback ?? 0;
    this.lastHitstop = hit.hitstop ?? 0;
    this.hits += 1;

    return true;
  }
}

registerScriptMetadata(HurtboxScript, {
  exposed: {
    invincibilityDuration: ScriptMetadata.field(),
  },
});
