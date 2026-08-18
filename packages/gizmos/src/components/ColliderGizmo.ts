import type { Color } from "@atlasjs/nebula";

export class ColliderGizmo {
  public color: Color | null;

  public constructor(color: Color | null = null) {
    this.color = color;
  }
}
