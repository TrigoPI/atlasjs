import { Bound, Vec2 } from "@atlasjs/math";
import { Node } from "./Node";
import { Texture2D, Sampler } from "../resources";

export class Sprite extends Node {
  public readonly texture: Texture2D;
  public readonly sampler?: Sampler;

  private readonly anchor: Vec2;
  private readonly sourceRect: Bound;

  public constructor(texture: Texture2D, sampler?: Sampler) {
    super();
    this.texture = texture;
    this.sampler = sampler;
    this.anchor = new Vec2(0.5, 0.5);
    this.sourceRect = new Bound(0, 0, texture.width, texture.height);
  }

  public getSourceRect(): Bound {
    return this.sourceRect.clone();
  }

  public setSourceRect(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Sprite {
    this.sourceRect.set(x, y, width, height);
    return this;
  }

  public getAnchor(): Vec2 {
    return this.anchor.clone();
  }

  public setAnchor(x: number, y: number): Sprite {
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      throw new Error("Anchor coordinates must be between 0 and 1.");
    }

    this.anchor.set(x, y);

    return this;
  }
}
