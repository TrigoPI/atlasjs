import { TimeControl } from "@atlasjs/core";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { TimeScale } from "../components";

type FreezeRecord = {
  remaining: number;
  previous: number | undefined;
};

export class TimeScaleManager {
  private readonly world: NexusWorld;
  private readonly time: TimeControl;
  private readonly memo: Map<Entity, number>;
  private readonly freezes: Map<Entity, FreezeRecord>;
  private readonly expired: Entity[];

  private active: boolean;

  public constructor(world: NexusWorld, time: TimeControl) {
    this.world = world;
    this.time = time;
    this.memo = new Map<Entity, number>();
    this.freezes = new Map<Entity, FreezeRecord>();
    this.expired = [];
    this.active = false;
  }

  public get globalScale(): number {
    return this.time.scale;
  }

  public set globalScale(value: number) {
    this.time.scale = value;
  }

  public update(dt: number): void {
    this.advanceFreezes(dt);
    this.beginFrame();
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

  public setScale(entity: Entity, value: number): void {
    if (!this.world.exists(entity)) {
      return;
    }

    const existing: TimeScale | undefined = this.world.getComponent(
      entity,
      TimeScale,
    );

    if (existing === undefined) {
      this.world.addComponent(entity, TimeScale, value);
    } else {
      existing.value = value;
    }

    this.active = true;
    this.memo.clear();
  }

  public clearScale(entity: Entity): void {
    if (!this.world.exists(entity)) {
      return;
    }

    if (this.world.getComponent(entity, TimeScale) !== undefined) {
      this.world.removeComponent(entity, TimeScale);
      this.memo.clear();
    }
  }

  public freeze(seconds: number, entities: readonly Entity[]): void {
    if (!(seconds > 0)) {
      return;
    }

    for (let i: number = 0; i < entities.length; i++) {
      this.freezeOne(seconds, entities[i]);
    }
  }

  private freezeOne(seconds: number, entity: Entity): void {
    if (!this.world.exists(entity)) {
      return;
    }

    const running: FreezeRecord | undefined = this.freezes.get(entity);

    if (running !== undefined) {
      running.remaining = Math.max(running.remaining, seconds);
      return;
    }

    const existing: TimeScale | undefined = this.world.getComponent(
      entity,
      TimeScale,
    );

    this.freezes.set(entity, {
      remaining: seconds,
      previous: existing === undefined ? undefined : existing.value,
    });

    this.setScale(entity, 0);
  }

  private advanceFreezes(dt: number): void {
    if (this.freezes.size === 0) {
      return;
    }

    this.expired.length = 0;

    for (const [entity, record] of this.freezes) {
      record.remaining -= dt;

      if (record.remaining <= 0) {
        this.expired.push(entity);
      }
    }

    for (let i: number = 0; i < this.expired.length; i++) {
      const entity: Entity = this.expired[i];
      const record: FreezeRecord = this.freezes.get(entity)!;

      this.freezes.delete(entity);

      if (!this.world.exists(entity)) {
        continue;
      }

      if (record.previous === undefined) {
        this.clearScale(entity);
        continue;
      }

      this.setScale(entity, record.previous);
    }

    this.expired.length = 0;
  }
}
