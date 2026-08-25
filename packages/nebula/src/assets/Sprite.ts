import { Bound, Vec2 } from "@atlasjs/math";
import type { Texture2D } from "../core";
import type { Resource } from "@atlasjs/assets";

export interface SpriteOptions {
  rect?: Bound;
  pivot?: Vec2;
  id?: string;
}

export class Sprite implements Resource {
  public readonly id: string;
  public readonly texture: Texture2D;
  public readonly rect: Bound;
  public readonly pivot: Vec2;

  // prettier-ignore
  public constructor(texture: Texture2D, options?: SpriteOptions) {
    this.texture = texture;
    this.pivot = options?.pivot?.clone() ?? new Vec2(0.5, 0.5);
    this.rect = options?.rect?.clone() ?? new Bound(0, 0, texture.width, texture.height);

    this.id =
      options?.id ??
      `sprite:${texture.id}:${this.rect.x}:${this.rect.y}:${this.rect.width}:${this.rect.height}`;
  }

  public destroy(): void {}
}
