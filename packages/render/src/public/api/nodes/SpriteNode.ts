import { TextureHandle } from "@atlasjs/assets";
import { Bound, Box2, Vec2, Vec2Like } from "@atlasjs/math";

import { ISpriteDriver } from "../../../backend";
import { NodeConstructorOptions } from "./types";
import { Node } from "./Node";

export class SpriteNode extends Node<ISpriteDriver> {
  private textureSize: Box2;
  private anchor: Vec2;

  public constructor(opts: NodeConstructorOptions<ISpriteDriver>) {
    super(opts);
    this.textureSize = new Box2();
    this.anchor = new Vec2();
  }

  public override getLocalBound(): Bound {
    const x: number = -this.anchor.x * this.textureSize.width;
    const y: number = -this.anchor.y * this.textureSize.height;
    const width: number = this.textureSize.width;
    const height: number = this.textureSize.height;
    return Bound.create(x, y, width, height);
  }

  public override hitTestLocal(p: Vec2Like): boolean {
    if (this.textureSize.width === 0 || this.textureSize.height === 0) {
      return false;
    }

    const minX: number = -this.anchor.x * this.textureSize.width;
    const maxX: number = (1 - this.anchor.x) * this.textureSize.width;
    const minY: number = -this.anchor.y * this.textureSize.height;
    const maxY: number = (1 - this.anchor.y) * this.textureSize.height;

    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  }

  public setTexture(handle: TextureHandle): SpriteNode {
    this.driver.setTexture(handle);

    const size: Box2 = this.driver.getTextureSize();
    this.textureSize.width = size.width;
    this.textureSize.height = size.height;

    return this;
  }

  public setSize(w: number, h: number): SpriteNode {
    this.driver.setSize(w, h);
    return this;
  }

  public setAnchor(ax: number, ay: number): SpriteNode {
    this.anchor.set(ax, ay);
    this.driver.setAnchor(ax, ay);
    return this;
  }
}
