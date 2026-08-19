import { Vec2 } from "@atlasjs/math";
import { Color } from "@atlasjs/nebula";
import { WorldTransform2D } from "@atlasjs/gameplay";
import type { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { Gizmos } from "../Gizmos";
import { GizmoSettings } from "../GizmoSettings";
import { PivotGizmo } from "../components/PivotGizmo";

export class PivotGizmoSystem implements NexusSystem {
  private readonly gizmos: Gizmos;
  private readonly positionScratch: Vec2;

  public constructor(gizmos: Gizmos) {
    this.gizmos = gizmos;
    this.positionScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const settings: GizmoSettings = this.gizmos.settings;

    world.query(WorldTransform2D).optional(PivotGizmo).each((
      _entity: Entity,
      worldTransform: WorldTransform2D,
      gizmo: PivotGizmo | undefined,
    ) => {
      if (!settings.showPivots && gizmo === undefined) {
        return;
      }

      const color: Color = gizmo?.color ?? settings.pivotColor;
      const radius: number = gizmo?.radius ?? settings.pivotRadius;
      const position: Vec2 = worldTransform.getPosition(this.positionScratch);

      this.gizmos.color.set(color.r, color.g, color.b, color.a);
      this.gizmos.borderWidth = 0;
      this.gizmos.drawCircle(position.x, position.y, radius);
    });
  }
}
