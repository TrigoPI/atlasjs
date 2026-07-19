import { Bound, Vec2 } from "@atlasjs/math";
import { Asset } from "@atlasjs/assets";
import { TextureAsset } from "@atlasjs/nebula";

export interface SpriteAssetOptions {
  readonly rect?: Bound;
  readonly pivot?: Vec2;
  readonly id?: string;
}

function getPivotKey(pivot?: Vec2): string {
  return pivot ? `${pivot.x}:${pivot.y}` : "center";
}

function getRectKey(rect?: Bound): string {
  return rect ? `${rect.x}:${rect.y}:${rect.width}:${rect.height}` : "full";
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

    const pivotKey: string = getPivotKey(this.pivot);
    const rectKey: string = getRectKey(this.rect);

    this.id = options?.id ?? `sprite:${texture.id}:${rectKey}:${pivotKey}`;
  }

  public static fromPath(path: string): SpriteAsset {
    const texture: TextureAsset = new TextureAsset(path);
    return new SpriteAsset(texture);
  }
}
