import { Bound, Box2, Vec2 } from "@atlasjs/math";
import { Texture2D } from "@atlasjs/assets";

import { DirtyQueue } from "../graph";
import { Node } from "./Node";

export class SpriteNode extends Node {
  public override kind: string;

  private readonly anchor: Vec2;
  private readonly sourceFrame: Bound;

  private alpha: number;
  private texture: Texture2D;

  public constructor(texture: Texture2D, dirty: DirtyQueue<Node>, id?: string) {
    super(dirty, id);
    this.kind = "sprite";
    this.texture = texture;
    this.anchor = Vec2.create(0.5, 0.5);
    this.sourceFrame = Bound.create(0, 0, texture.width, texture.height);
    this.alpha = 1;
  }

  private getWidth(): number {
    return this.sourceFrame.width > 0
      ? this.sourceFrame.width
      : this.texture.width;
  }

  private getHeight(): number {
    return this.sourceFrame.height > 0
      ? this.sourceFrame.height
      : this.texture.height;
  }

  public override getLocalBound(): Bound {
    const w: number = this.getWidth();
    const h: number = this.getHeight();
    const x: number = -this.anchor.x * w;
    const y: number = -this.anchor.y * h;
    return new Bound(x, y, w, h);
  }

  public override hitTestLocal(p: Vec2): boolean {
    const w: number = this.getWidth();
    const h: number = this.getHeight();

    const left: number = -this.anchor.x * w;
    const top: number = -this.anchor.y * h;
    const right: number = left + w;
    const bottom: number = top + h;

    return p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
  }

  public getAnchor(): Vec2 {
    return this.anchor.copy();
  }

  public getTexture(): Texture2D {
    return this.texture;
  }

  public getSourceFrame(): Bound {
    return this.sourceFrame.copy();
  }

  public setSourceFrame(
    x: number,
    y: number,
    width: number,
    height: number,
  ): this {
    this.sourceFrame.x = x;
    this.sourceFrame.y = y;
    this.sourceFrame.width = width;
    this.sourceFrame.height = height;
    return this;
  }

  public resetSourceFrame(): this {
    this.sourceFrame.x = 0;
    this.sourceFrame.y = 0;
    this.sourceFrame.width = this.texture.width;
    this.sourceFrame.height = this.texture.height;
    return this;
  }

  public setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  public getAlpha(): number {
    return this.alpha;
  }

  public setTexture(handle: Texture2D): this {
    this.texture = handle;
    return this.resetSourceFrame();
  }

  public setAnchor(x: number, y: number): this {
    this.anchor.set(x, y);
    return this;
  }
}
