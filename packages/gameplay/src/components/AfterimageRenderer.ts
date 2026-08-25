import { Color } from "@atlasjs/nebula";

export type AfterimageRendererCommand = "none" | "clear";

export interface AfterimageRendererOptions {
  interval?: number;
  minDistance?: number;
  time?: number;
  startColor?: Color;
  endColor?: Color;
  emitting?: boolean;
  maxImages?: number;
  visible?: boolean;
  sortingLayer?: string;
  sortingOrder?: number;
}

export class AfterimageRenderer {
  public interval: number;
  public minDistance: number;
  public time: number;
  public startColor: Color;
  public endColor: Color;
  public emitting: boolean;
  public maxImages: number;
  public visible: boolean;
  public sortingLayer: string;
  public sortingOrder: number;
  public command: AfterimageRendererCommand;

  public constructor(options?: AfterimageRendererOptions) {
    this.interval = options?.interval ?? 0.05;
    this.minDistance = options?.minDistance ?? 0;
    this.time = options?.time ?? 0.25;
    this.startColor = options?.startColor ?? new Color(1, 1, 1, 0.5);
    this.endColor = options?.endColor ?? new Color(1, 1, 1, 0);
    this.emitting = options?.emitting ?? true;
    this.maxImages = options?.maxImages ?? 16;
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
