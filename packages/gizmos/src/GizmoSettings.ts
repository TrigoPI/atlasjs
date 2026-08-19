import { Color } from "@atlasjs/nebula";

export class GizmoSettings {
  public showColliders: boolean;
  public showPivots: boolean;
  public colliderColor: Color;
  public sensorColor: Color;
  public pivotColor: Color;
  public pivotRadius: number;
  public borderWidth: number;

  public constructor(options: GizmoPluginOptions = {}) {
    this.showColliders = options.showColliders ?? false;
    this.showPivots = options.showPivots ?? false;
    this.colliderColor = options.colliderColor ?? new Color(0, 1, 0, 1);
    this.sensorColor = options.sensorColor ?? new Color(0, 1, 1, 1);
    this.pivotColor = options.pivotColor ?? new Color(1, 0, 1, 1);
    this.pivotRadius = options.pivotRadius ?? 2;
    this.borderWidth = options.borderWidth ?? 1;
  }
}

export type GizmoPluginOptions = Partial<{
  showColliders: boolean;
  showPivots: boolean;
  colliderColor: Color;
  sensorColor: Color;
  pivotColor: Color;
  pivotRadius: number;
  borderWidth: number;
}>;
