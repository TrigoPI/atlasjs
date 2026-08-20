import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

export type HitInfo = {
  direction: Vec2;
  knockback?: number;
  invincibilityDuration?: number;
};

type HurtboxScriptProps = {
  invincibilityDuration?: number;
};

export class HurtboxScript extends AtlasScript<HurtboxScriptProps> {
  private readonly invincibilityDuration: number = 0.4;
  private readonly lastDirection: Vec2 = new Vec2();

  private invincibilityRemaining: number = 0;
  private lastKnockback: number = 0;

  public get isInvincible(): boolean {
    return this.invincibilityRemaining > 0;
  }

  public get hitDirection(): Vec2 {
    return this.lastDirection;
  }

  public get hitKnockback(): number {
    return this.lastKnockback;
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

    this.invincibilityRemaining =
      hit.invincibilityDuration ?? this.invincibilityDuration;

    this.lastDirection.copyFrom(hit.direction).normalize();
    this.lastKnockback = hit.knockback ?? 0;

    return true;
  }
}

registerScriptMetadata(HurtboxScript, {
  exposed: {
    invincibilityDuration: ScriptMetadata.field(),
  },
});
