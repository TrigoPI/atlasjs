import { Entity, NexusWorld } from "@atlasjs/nexus";

import { TimeScale } from "../components";

export class TimeScaleManager {
  private readonly world: NexusWorld;
  private readonly memo: Map<Entity, number>;

  private active: boolean;

  public constructor(world: NexusWorld) {
    this.world = world;
    this.memo = new Map<Entity, number>();
    this.active = false;
  }

  public beginFrame(): void {
    this.memo.clear();
    this.active = this.world.query(TimeScale).size > 0;
  }

  public scaleOf(entity: Entity): number {
    if (!this.active) {
      return 1;
    }

    if (!this.world.exists(entity)) {
      return 1;
    }

    const memoized: number | undefined = this.memo.get(entity);

    if (memoized !== undefined) {
      return memoized;
    }

    const own: TimeScale | undefined = this.world.getComponent(
      entity,
      TimeScale,
    );

    const local: number = own === undefined ? 1 : own.value;
    const parent: Entity | undefined = this.world.getParent(entity);
    const inherited: number = parent === undefined ? 1 : this.scaleOf(parent);
    const resolved: number = local * inherited;

    this.memo.set(entity, resolved);

    return resolved;
  }
}
