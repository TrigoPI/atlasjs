import type { Vec2 } from "@atlasjs/math";
import type { Asset } from "@atlasjs/assets";
import { TextureAsset } from "./TextureAsset";

export interface TileSetAssetOptions {
  tileWidth: number;
  tileHeight: number;
  columns?: number;
  rows?: number;
  spacing?: number;
  margin?: number;
  pivot?: Vec2;
  id?: string;
}

export class TileSetAsset implements Asset {
  public readonly type: string = "tileset";
  public readonly id: string;
  public readonly texture: TextureAsset;
  public readonly tileWidth: number;
  public readonly tileHeight: number;
  public readonly columns?: number;
  public readonly rows?: number;
  public readonly spacing: number;
  public readonly margin: number;
  public readonly pivot?: Vec2;

  public constructor(texture: TextureAsset, options: TileSetAssetOptions) {
    this.texture = texture;
    this.tileWidth = options.tileWidth;
    this.tileHeight = options.tileHeight;
    this.columns = options.columns;
    this.rows = options.rows;
    this.spacing = options.spacing ?? 0;
    this.margin = options.margin ?? 0;
    this.pivot = options.pivot;

    const cols: string =
      options.columns === undefined ? "auto" : `${options.columns}`;
    const rows: string =
      options.rows === undefined ? "auto" : `${options.rows}`;
    this.id =
      options.id ??
      `${this.type}:${texture.id}:${this.tileWidth}x${this.tileHeight}:${cols}x${rows}:${this.spacing}:${this.margin}`;
  }

  public static fromPath(
    path: string,
    options: TileSetAssetOptions,
  ): TileSetAsset {
    return new TileSetAsset(new TextureAsset(path), options);
  }
}
