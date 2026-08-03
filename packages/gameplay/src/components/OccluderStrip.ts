import type { TileInstance, Texture2D } from "@atlasjs/nebula";

export class OccluderStrip {
  public footY: number;
  public tiles: TileInstance[];
  public texture: Texture2D;
  public sortingLayer: string;

  public constructor(
    footY: number,
    tiles: TileInstance[],
    texture: Texture2D,
    sortingLayer: string,
  ) {
    this.footY = footY;
    this.tiles = tiles;
    this.texture = texture;
    this.sortingLayer = sortingLayer;
  }
}
