import { Bound, Vec2 } from "@atlasjs/math";
import { Texture2D } from "../core";

export class Frame {
  public readonly texture: Texture2D;
  public readonly rect: Bound;
  public readonly pivot: Vec2;

  public constructor(texture: Texture2D, rect: Bound, pivot: Vec2 = new Vec2(0.5, 0.5)) {
    this.texture = texture;
    this.rect = rect;
    this.pivot = pivot;
  }

  public clone(): Frame {
    return new Frame(this.texture, this.rect.clone(), this.pivot.clone());
  }
}
