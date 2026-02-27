import { Bound, Box2, Vec2 } from "@atlasjs/math";
import { Texture2D } from "@atlasjs/assets";

import { DirtyQueue } from "../graph";
import { Node } from "./Node";

export class SpriteNode extends Node {
  public override kind: string;

  private readonly size: Box2;
  private readonly anchor: Vec2;

  private alpha: number;
  private texture: Texture2D;

  public constructor(texture: Texture2D, dirty: DirtyQueue<Node>, id?: string) {
    super(dirty, id);
    this.kind = "sprite";
    this.texture = texture;
    this.size = Box2.create();
    this.anchor = Vec2.create(0.5, 0.5);
    this.alpha = 1;
  }

  public override getLocalBound(): Bound {
    const w: number = this.texture.width;
    const h: number = this.texture.height;
    const x: number = -this.anchor.x * w;
    const y: number = -this.anchor.y * h;
    return new Bound(x, y, w, h);
  }

  public override hitTestLocal(p: Vec2): boolean {
    const w: number = this.texture.width;
    const h: number = this.texture.height;

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

  public setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  public getAlpha(): number {
    return this.alpha;
  }

  public setTexture(handle: Texture2D): this {
    this.texture = handle;
    return this;
  }

  public setAnchor(x: number, y: number): this {
    this.anchor.set(x, y);
    return this;
  }
}
