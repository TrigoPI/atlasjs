import { Bound, Vec2 } from "@atlasjs/math";
import { Asset } from "@atlasjs/assets";
import { TextureAsset } from "@atlasjs/nebula";

export interface SpriteAssetOptions {
  readonly rect?: Bound;
  readonly pivot?: Vec2;
  readonly id?: string;
}

export class SpriteAsset implements Asset {
  public readonly type: string = "sprite";
  public readonly id: string;
  public readonly texture: TextureAsset;
  public readonly rect?: Bound;
  public readonly pivot?: Vec2;

  // prettier-ignore
  public constructor(texture: TextureAsset, options?: SpriteAssetOptions) {
    this.texture = texture;
    this.rect = options?.rect?.clone();
    this.pivot = options?.pivot?.clone();

    const rectKey: string = this.rect
      ? `${this.rect.x}:${this.rect.y}:${this.rect.width}:${this.rect.height}`
      : "full";
    const pivotKey: string = this.pivot ? `${this.pivot.x}:${this.pivot.y}` : "center";

    this.id = options?.id ?? `sprite:${texture.id}:${rectKey}:${pivotKey}`;
  }
}
