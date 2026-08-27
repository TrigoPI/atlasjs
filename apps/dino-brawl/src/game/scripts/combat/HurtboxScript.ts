import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";

import type { Countdown } from "@atlasjs/gameplay";
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

  private invincibility: Countdown;
  private lastKnockback: number = 0;
  private lastHitstop: number = 0;
  private hits: number = 0;

  public get isInvincible(): boolean {
    return !this.invincibility.done;
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

  public onCreate(): void {
    this.invincibility = this.countdown(0);
  }

  public grantInvincibility(duration: number): void {
    if (duration > this.invincibility.remaining) {
      this.invincibility.reset(duration);
    }
  }

  public takeHit(hit: HitInfo): boolean {
    if (!this.invincibility.done) {
      return false;
    }

    this.invincibility.reset(this.invincibilityDuration);

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
