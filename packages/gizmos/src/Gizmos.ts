import { Color } from "@atlasjs/nebula";
import type { CircleNode, RectNode } from "@atlasjs/nebula";

import { GizmoNodePool } from "./GizmoNodePool";
import { GizmoSettings } from "./GizmoSettings";

export class Gizmos {
  public readonly settings: GizmoSettings;
  public readonly color: Color;
  public borderWidth: number;

  private readonly pool: GizmoNodePool;

  public constructor(pool: GizmoNodePool, settings: GizmoSettings) {
    this.pool = pool;
    this.settings = settings;
    this.color = new Color(1, 1, 1, 1);
    this.borderWidth = settings.borderWidth;
  }

  public drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
  ): void {
    const node: RectNode = this.pool.acquireRect();

    node
      .setColor(this.color.r, this.color.g, this.color.b, this.color.a)
      .setBorderWidth(this.borderWidth);

    node.setPosition(x, y).setRotation(rotation);
    node.setSize(width, height);
  }

  public drawCircle(x: number, y: number, radius: number): void {
    const node: CircleNode = this.pool.acquireCircle();

    node
      .setColor(this.color.r, this.color.g, this.color.b, this.color.a)
      .setBorderWidth(this.borderWidth);

    node.setPosition(x, y).setRotation(0);
    node.setRadius(radius);
  }
}
