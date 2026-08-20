import { TIME, TimeControl } from "@atlasjs/core";

import { ScriptService } from "../core";

export class TimeApi extends ScriptService<TimeControl> {
  public static readonly token = TIME;

  /** 1 is real time, 0 freezes the simulation. Clamped to 0 or above. */
  public get scale(): number {
    return this.provided.scale;
  }

  public set scale(value: number) {
    this.provided.scale = value;
  }
}
