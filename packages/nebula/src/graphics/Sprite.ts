import { Bound, Vec2, Vec4 } from "@atlasjs/math";

import { BlendMode, Sampler, Texture2D } from "../core";
import { Frame } from "../animations";
import { Node } from "./Node";

export class Sprite extends Node {
  public readonly texture: Texture2D;
  public readonly sampler?: Sampler;
  public readonly tint: Vec4;

  public blend: BlendMode;

  private readonly anchor: Vec2;
  private readonly sourceRect: Bound;

  public constructor(texture: Texture2D, sampler?: Sampler) {
    super();
    this.texture = texture;
    this.sampler = sampler;
    this.tint = new Vec4(1, 1, 1, 1);
    this.blend = "alpha";
    this.anchor = new Vec2(0.5, 0.5);
    this.sourceRect = new Bound(0, 0, texture.width, texture.height);
  }

  public setTint(r: number, g: number, b: number, a: number = 1): Sprite {
    this.tint.set(r, g, b, a);
    return this;
  }

  public setBlend(blend: BlendMode): Sprite {
    this.blend = blend;
    return this;
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

  public getSourceRect(out: Bound = new Bound()): Bound {
    return out.set(
      this.sourceRect.x,
      this.sourceRect.y,
      this.sourceRect.width,
      this.sourceRect.height,
    );
  }

  public getLocalBound(): Bound {
    const width: number = this.sourceRect.width;
    const height: number = this.sourceRect.height;

    const x: number = -this.anchor.x * width;
    const y: number = -this.anchor.y * height;

    return new Bound(x, y, width, height);
  }

  public getWorldBound(out: Bound = new Bound()): Bound {
    const width: number = this.sourceRect.width;
    const height: number = this.sourceRect.height;

    const localX: number = -this.anchor.x * width;
    const localY: number = -this.anchor.y * height;

    const m: Float32Array = this.worldMatrix.buffer;
    const m0: number = m[0];
    const m1: number = m[1];
    const m4: number = m[4];
    const m5: number = m[5];
    const m12: number = m[12];
    const m13: number = m[13];

    const x0: number = localX;
    const y0: number = localY;
    const x1: number = localX + width;
    const y1: number = localY;
    const x2: number = localX;
    const y2: number = localY + height;
    const x3: number = localX + width;
    const y3: number = localY + height;

    const px0: number = m0 * x0 + m4 * y0 + m12;
    const py0: number = m1 * x0 + m5 * y0 + m13;
    const px1: number = m0 * x1 + m4 * y1 + m12;
    const py1: number = m1 * x1 + m5 * y1 + m13;
    const px2: number = m0 * x2 + m4 * y2 + m12;
    const py2: number = m1 * x2 + m5 * y2 + m13;
    const px3: number = m0 * x3 + m4 * y3 + m12;
    const py3: number = m1 * x3 + m5 * y3 + m13;

    const minX: number = Math.min(px0, px1, px2, px3);
    const minY: number = Math.min(py0, py1, py2, py3);
    const maxX: number = Math.max(px0, px1, px2, px3);
    const maxY: number = Math.max(py0, py1, py2, py3);

    return out.set(minX, minY, maxX - minX, maxY - minY);
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
