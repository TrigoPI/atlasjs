import { Vec2Like, Box2, Bound } from "@atlasjs/math";

import { IRectDriver } from "../../../backend";
import { RectStyle } from "../../types";
import { Node } from "./Node";

export class RectNode extends Node<IRectDriver> {
  public override hitTestLocal(p: Vec2Like): boolean {
    const size: Box2 = this.driver.getSize();
    const halfW: number = size.width * 0.5;
    const halfH: number = size.height * 0.5;
    return p.x >= -halfW && p.y >= -halfH && p.x <= halfW && p.y <= halfH;
  }

  public override getLocalBound(): Bound {
    const size: Box2 = this.driver.getSize();
    return new Bound(
      -size.width * 0.5,
      -size.height * 0.5,
      size.width,
      size.height,
    );
  }

  public setFillColor(color: number): RectNode {
    this.driver.setFillColor(color);
    return this;
  }

  public setFillAlpha(alpha: number): RectNode {
    this.driver.setFillAlpha(alpha);
    return this;
  }

  public setStrokeWidth(width: number): RectNode {
    this.driver.setStrokeWidth(width);
    return this;
  }

  public setStrokeColor(color: number): RectNode {
    this.driver.setStrokeColor(color);
    return this;
  }

  public setStrokeAlpha(alpha: number): RectNode {
    this.driver.setStrokeAlpha(alpha);
    return this;
  }

  public setSize(width: number, height: number): RectNode {
    this.driver.setSize(width, height);
    return this;
  }

  public setStyle(patch: Partial<RectStyle>): RectNode {
    this.driver.setStyle(patch);
    return this;
  }
}
