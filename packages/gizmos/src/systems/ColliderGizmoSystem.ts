import { createLogger, Logger } from "@atlasjs/utils";
import { Color } from "@atlasjs/nebula";
import type { Vec2 } from "@atlasjs/math";
import type { Collider, ColliderShapeDesc } from "@atlasjs/inertia";
import { Collider2D, PhysicsColliderRef } from "@atlasjs/gameplay";
import type { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { Gizmos } from "../Gizmos";
import { GizmoSettings } from "../GizmoSettings";
import { ColliderGizmo } from "../components/ColliderGizmo";

type UnsupportedShapeType = Exclude<
  ColliderShapeDesc["type"],
  "box" | "circle"
>;

export class ColliderGizmoSystem implements NexusSystem {
  private readonly gizmos: Gizmos;
  private readonly logger: Logger;
  private readonly warned: Set<UnsupportedShapeType>;

  public constructor(gizmos: Gizmos) {
    this.gizmos = gizmos;
    this.logger = createLogger(ColliderGizmoSystem.name);
    this.warned = new Set<UnsupportedShapeType>();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const settings: GizmoSettings = this.gizmos.settings;

    world.query(Collider2D, PhysicsColliderRef).optional(ColliderGizmo).each((
      _entity: Entity,
      collider: Collider2D,
      ref: PhysicsColliderRef,
      gizmo: ColliderGizmo | undefined,
    ) => {
      if (!settings.showColliders && gizmo === undefined) {
        return;
      }

      const shape: ColliderShapeDesc = collider.shape;

      if (shape.type !== "box" && shape.type !== "circle") {
        this.warnOnce(shape.type);
        return;
      }

      const fallback: Color = collider.isSensor
        ? settings.sensorColor
        : settings.colliderColor;

      const color: Color = gizmo?.color ?? fallback;

      this.gizmos.color.set(color.r, color.g, color.b, color.a);
      this.gizmos.borderWidth = settings.borderWidth;

      const physics: Collider = ref.collider;
      const translation: Vec2 = physics.getTranslation();

      if (shape.type === "box") {
        this.gizmos.drawRect(
          translation.x,
          translation.y,
          shape.width,
          shape.height,
          physics.getRotation(),
        );

        return;
      }

      this.gizmos.drawCircle(translation.x, translation.y, shape.radius);
    });
  }

  private warnOnce(type: UnsupportedShapeType): void {
    if (this.warned.has(type)) {
      return;
    }

    this.warned.add(type);
    this.logger.warn(
      `Collider gizmo does not support shape '${type}'; nothing drawn.`,
    );
  }
}
