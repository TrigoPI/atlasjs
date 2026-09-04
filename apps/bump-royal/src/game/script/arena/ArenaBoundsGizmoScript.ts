import type { Vec2 } from "@atlasjs/math";
import type { Color } from "@atlasjs/nebula";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

import { arenaVertices, type ArenaBounds } from "../../arena";
import { GizmosApi } from "../../services";

type ArenaBoundsGizmoScriptProps = {
  bounds: ArenaBounds;
  color: Color;
  thickness: number;
};

export class ArenaBoundsGizmoScript extends AtlasScript<ArenaBoundsGizmoScriptProps> {
  private readonly bounds: ArenaBounds;
  private readonly color: Color;
  private readonly thickness: number;

  private gizmos: GizmosApi;
  private vertices: Vec2[];

  public onCreate(): void {
    this.gizmos = this.getService(GizmosApi);
    this.vertices = arenaVertices(this.bounds);
  }

  public onUpdate(): void {
    const count: number = this.vertices.length;

    for (let i: number = 0; i < count; i += 1) {
      const from: Vec2 = this.vertices[i];
      const to: Vec2 = this.vertices[(i + 1) % count];

      this.gizmos.drawLine(from, to, this.color, this.thickness);
    }
  }
}

registerScriptMetadata(ArenaBoundsGizmoScript, {
  exposed: {
    bounds: ScriptMetadata.field({ required: true }),
    color: ScriptMetadata.field({ required: true }),
    thickness: ScriptMetadata.field({ required: true }),
  },
});
