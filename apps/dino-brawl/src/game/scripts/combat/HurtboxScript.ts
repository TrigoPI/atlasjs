import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";

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
  owner?: Entity;
};

export class HurtboxScript extends AtlasScript<HurtboxScriptProps> {
  private readonly invincibilityDuration: number = 0;
  public readonly owner?: Entity;

  private readonly lastDirection: Vec2 = new Vec2();

  private invincibilityRemaining: number = 0;
  private lastKnockback: number = 0;
  private lastHitstop: number = 0;
  private hits: number = 0;

  public get isInvincible(): boolean {
    return this.invincibilityRemaining > 0;
  }

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

  public grantInvincibility(duration: number): void {
    this.invincibilityRemaining = Math.max(
      this.invincibilityRemaining,
      duration,
    );
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
    owner: ScriptMetadata.field(),
  },
});
