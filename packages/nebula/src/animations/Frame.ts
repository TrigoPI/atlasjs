import { Bound } from "@atlasjs/math";
import { Texture2D } from "../core";

export class Frame {
  public readonly texture: Texture2D;
  public readonly rect: Bound;

  public constructor(texture: Texture2D, rect: Bound) {
    this.texture = texture;
    this.rect = rect;
  }

  public clone(): Frame {
    return new Frame(this.texture, this.rect.clone());
  }
}
