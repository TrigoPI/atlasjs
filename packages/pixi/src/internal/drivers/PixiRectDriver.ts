import { Box2, Transform2DLike } from "@atlasjs/math";
import { RectStyle } from "@atlasjs/render";
import { IRectDriver } from "@atlasjs/render/backend";

import { Graphics } from "pixi.js";

import { PixiNodeDriver } from "./PixiNodeDriver";

export class PixiRectDriver
  extends PixiNodeDriver<Graphics>
  implements IRectDriver
{
  private style: RectStyle;

  private halfW: number;
  private halfH: number;

  public constructor(
    style: RectStyle = {
      size: Box2.create(100, 100),
      color: 0x00ffcc,
      alpha: 1,
      strokeWidth: 0,
      strokeColor: 0x000000,
      strokeAlpha: 1,
    },
  ) {
    super(new Graphics());

    this.style = style;
    this.halfW = style.size.width * 0.5;
    this.halfH = style.size.height * 0.5;

    this.redraw();
  }

  public getSize(): Box2 {
    return this.style.size.copy();
  }

  public setFillColor(color: number): void {
    this.style.color = color;
    this.redraw();
  }

  public setFillAlpha(alpha: number): void {
    this.style.alpha = alpha;
    this.redraw();
  }

  public setStrokeWidth(width: number): void {
    this.style.strokeWidth = width;
    this.redraw();
  }

  public setStrokeColor(color: number): void {
    this.style.strokeColor = color;
    this.redraw();
  }

  public setStrokeAlpha(alpha: number): void {
    this.style.strokeAlpha = alpha;
    this.redraw();
  }

  public setSize(width: number, height: number): void {
    this.style.size = Box2.create(width, height);
    this.redraw();
  }

  public setStyle(patch: Partial<RectStyle>): void {
    this.style = { ...this.style, ...patch };
    this.redraw();
  }

  private redraw(): void {
    const { size, color, alpha }: RectStyle = this.style;

    this.halfW = size.width * 0.5;
    this.halfH = size.height * 0.5;

    this.obj.clear();
    this.obj.rect(-this.halfW, -this.halfH, size.width, size.height);
    this.obj.fill({ color: color ?? 0x00ffcc, alpha: alpha ?? 1 });

    if (this.style.strokeWidth && this.style.strokeWidth > 0) {
      this.obj.stroke({
        width: this.style.strokeWidth,
        color: this.style?.strokeColor ?? 0x000000,
        alpha: this.style?.strokeAlpha ?? 1,
      });
    }
  }
}
