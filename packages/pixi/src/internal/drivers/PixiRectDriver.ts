import { RectStyle } from "@atlasjs/render";
import { IRectDriver } from "@atlasjs/render/backend";

import { Graphics } from "pixi.js";

import { PixiNodeDriver } from "./PixiNodeDriver";

export class PixiRectDriver
  extends PixiNodeDriver<Graphics>
  implements IRectDriver
{
  private style: RectStyle;

  public constructor(initial: RectStyle) {
    super(new Graphics());
    this.style = initial;
    this.redraw();
  }

  public setStyle(patch: Partial<RectStyle>): void {
    this.style = { ...this.style, ...patch };
    this.redraw();
  }

  private redraw() {
    const { size, color, alpha }: RectStyle = this.style;

    this.obj.clear();
    this.obj.rect(0, 0, size.width, size.height);
    this.obj.fill({ color: color ?? 0x00ffcc, alpha: alpha ?? 1 });
  }
}
