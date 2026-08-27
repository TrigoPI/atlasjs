import { Entity } from "@atlasjs/nexus";

import { TIME_SCALE_MANAGER, TimeScaleManager } from "../../time";

import { ScriptService } from "../core";

export class TimeApi extends ScriptService<TimeScaleManager> {
  public static readonly token = TIME_SCALE_MANAGER;

  /** 1 is real time, 0 freezes the simulation. Clamped to 0 or above. */
  public get scale(): number {
    return this.provided.globalScale;
  }

  public set scale(value: number) {
    this.provided.globalScale = value;
  }

  public scaleOf(entity: Entity): number {
    return this.provided.scaleOf(entity);
  }

  public setScale(entity: Entity, value: number): void {
    this.provided.setScale(entity, value);
  }

  public clearScale(entity: Entity): void {
    this.provided.clearScale(entity);
  }

  public freeze(seconds: number, ...entities: Entity[]): void {
    this.provided.freeze(seconds, entities);
  }
}
