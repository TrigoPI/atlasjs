import type { Color } from "@atlasjs/nebula";

export class PivotGizmo {
  public color: Color | null;
  public radius: number | null;

  public constructor(color: Color | null = null, radius: number | null = null) {
    this.color = color;
    this.radius = radius;
  }
}
