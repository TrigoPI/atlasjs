import type { ServiceToken } from "@atlasjs/core";
import type { Vec2 } from "@atlasjs/math";
import type { Color } from "@atlasjs/nebula";

import { ScriptService } from "@atlasjs/gameplay";
import { GIZMOS, type Gizmos } from "@atlasjs/gizmos";

export class GizmosApi extends ScriptService<Gizmos> {
  public static readonly token: ServiceToken<Gizmos> = GIZMOS;

  public drawLine(from: Vec2, to: Vec2, color: Color, thickness: number): void {
    this.provided.color.set(color.r, color.g, color.b, color.a);
    this.provided.lineThickness = thickness;
    this.provided.drawLine(from.x, from.y, to.x, to.y);
  }
}
