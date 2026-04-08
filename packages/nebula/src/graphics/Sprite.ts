import { Bound, Vec2 } from "@atlasjs/math";

import { Sampler, Texture2D } from "../core";
import { Frame } from "../animations";
import { Node } from "./Node";

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

  public flipX(flip: boolean): Sprite {
    this.transform.scale.x = flip
      ? -Math.abs(this.transform.scale.x)
      : Math.abs(this.transform.scale.x);
    return this;
  }

  public flipY(flip: boolean): Sprite {
    this.transform.scale.y = flip
      ? -Math.abs(this.transform.scale.y)
      : Math.abs(this.transform.scale.y);
    return this;
  }

  public getSourceRect(): Bound {
    return this.sourceRect.clone();
  }

  public getLocalBound(): Bound {
    const width: number = this.sourceRect.width;
    const height: number = this.sourceRect.height;

    const x: number = -this.anchor.x * width;
    const y: number = -this.anchor.y * height;

    return new Bound(x, y, width, height);
  }

  public getWorldBound(): Bound {
    const local: Bound = this.getLocalBound();

    const local1X: number = local.x;
    const local1Y: number = local.y;

    const local2X: number = local.x + local.width;
    const local2Y: number = local.y;

    const local3X: number = local.x;
    const local3Y: number = local.y + local.height;

    const local4X: number = local.x + local.width;
    const local4Y: number = local.y + local.height;

    const p1: Vec2 = this.worldMatrix.transformPoint2(local1X, local1Y);
    const p2: Vec2 = this.worldMatrix.transformPoint2(local2X, local2Y);
    const p3: Vec2 = this.worldMatrix.transformPoint2(local3X, local3Y);
    const p4: Vec2 = this.worldMatrix.transformPoint2(local4X, local4Y);

    const minX: number = Math.min(p1.x, p2.x, p3.x, p4.x);
    const minY: number = Math.min(p1.y, p2.y, p3.y, p4.y);
    const maxX: number = Math.max(p1.x, p2.x, p3.x, p4.x);
    const maxY: number = Math.max(p1.y, p2.y, p3.y, p4.y);

    return new Bound(minX, minY, maxX - minX, maxY - minY);
  }

  public getAnchor(): Vec2 {
    return this.anchor.clone();
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

  public setFrame(frame: Frame): Sprite {
    const sourceRect: Bound = frame.rect.clone();
    this.sourceRect.set(
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
    );

    return this;
  }

  public setAnchor(x: number, y: number): Sprite {
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      throw new Error("Anchor coordinates must be between 0 and 1.");
    }

    this.anchor.set(x, y);

    return this;
  }
}
