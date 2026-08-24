import { BlendMode, Color } from "@atlasjs/nebula";

export type TrailRendererCommand = "none" | "clear";

export interface TrailRendererOptions {
  time?: number;
  minVertexDistance?: number;
  smoothing?: number;
  startWidth?: number;
  endWidth?: number;
  startColor?: Color;
  endColor?: Color;
  emitting?: boolean;
  maxPoints?: number;
  blend?: BlendMode;
  visible?: boolean;
  sortingLayer?: string;
  sortingOrder?: number;
}

export class TrailRenderer {
  public time: number;
  public minVertexDistance: number;
  public smoothing: number;
  public startWidth: number;
  public endWidth: number;
  public startColor: Color;
  public endColor: Color;
  public emitting: boolean;
  public maxPoints: number;
  public blend: BlendMode;
  public visible: boolean;
  public sortingLayer: string;
  public sortingOrder: number;
  public command: TrailRendererCommand;

  public constructor(options?: TrailRendererOptions) {
    this.time = options?.time ?? 0.2;
    this.minVertexDistance = options?.minVertexDistance ?? 2;
    this.smoothing = options?.smoothing ?? 3;
    this.startWidth = options?.startWidth ?? 8;
    this.endWidth = options?.endWidth ?? 0;
    this.startColor = options?.startColor ?? new Color(1, 1, 1, 1);
    this.endColor = options?.endColor ?? new Color(1, 1, 1, 0);
    this.emitting = options?.emitting ?? true;
    this.maxPoints = options?.maxPoints ?? 64;
    this.blend = options?.blend ?? "alpha";
    this.visible = options?.visible ?? true;
    this.sortingLayer = options?.sortingLayer ?? "Default";
    this.sortingOrder = options?.sortingOrder ?? 0;
    this.command = "none";
  }

  public clear(): this {
    this.command = "clear";
    return this;
  }
}
