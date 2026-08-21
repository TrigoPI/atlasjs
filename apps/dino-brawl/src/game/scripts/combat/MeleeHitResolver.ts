import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";
import type { GameEntity } from "@atlasjs/gameplay";

import { type HitInfo, HurtboxScript } from "./HurtboxScript";

export type MeleeTargetSource = {
  getTargets(): readonly GameEntity[];
};

export class MeleeHitResolver {
  private readonly targets: MeleeTargetSource;
  private readonly knockback: number;
  private readonly hitstop: number;

  private readonly struck: Set<Entity> = new Set<Entity>();
  private readonly hit: HitInfo = { direction: new Vec2() };

  public constructor(
    targets: MeleeTargetSource,
    knockback: number,
    hitstop: number,
  ) {
    this.targets = targets;
    this.knockback = knockback;
    this.hitstop = hitstop;
  }

  public beginSwing(): void {
    this.struck.clear();
  }

  public resolve(direction: Vec2): boolean {
    const targets: readonly GameEntity[] = this.targets.getTargets();
    let landed: boolean = false;

    this.hit.direction.copyFrom(direction);
    this.hit.knockback = this.knockback;
    this.hit.hitstop = this.hitstop;

    for (const target of targets) {
      if (this.struck.has(target.id)) {
        continue;
      }

      const hurtbox: HurtboxScript | undefined =
        target.getScript(HurtboxScript);

      if (hurtbox === undefined) {
        continue;
      }

      if (hurtbox.takeHit(this.hit)) {
        this.struck.add(target.id);
        landed = true;
      }
    }

    return landed;
  }
}
