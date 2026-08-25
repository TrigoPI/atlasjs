import type { Texture2D } from "../core";
import type { Resource } from "@atlasjs/assets";
import { Bound, type Vec2 } from "@atlasjs/math";
import { Sprite } from "./Sprite";
import { Tile } from "./Tile";

export interface TileSetOptions {
  tileWidth: number;
  tileHeight: number;
  columns?: number;
  rows?: number;
  spacing?: number;
  margin?: number;
  pivot?: Vec2;
  id?: string;
}

export class TileSet implements Resource {
  public readonly id: string;
  public readonly texture: Texture2D;
  public readonly columns: number;
  public readonly rows: number;

  private readonly tiles: Tile[];

  public constructor(texture: Texture2D, options: TileSetOptions) {
    const spacing: number = options.spacing ?? 0;
    const margin: number = options.margin ?? 0;
    const tileWidth: number = options.tileWidth;
    const tileHeight: number = options.tileHeight;

    // prettier-ignore
    const columns: number =
      options.columns ??
      Math.floor((texture.width - 2 * margin + spacing) / (tileWidth + spacing));

    // prettier-ignore
    const rows: number =
      options.rows ??
      Math.floor((texture.height - 2 * margin + spacing) / (tileHeight + spacing));

    this.texture = texture;
    this.columns = columns;
    this.rows = rows;
    this.id =
      options.id ??
      `tileset:${texture.id}:${tileWidth}x${tileHeight}:${columns}x${rows}:${spacing}:${margin}`;

    this.tiles = [];

    for (let row: number = 0; row < rows; row++) {
      for (let col: number = 0; col < columns; col++) {
        const index: number = row * columns + col;
        const rect: Bound = new Bound(
          margin + col * (tileWidth + spacing),
          margin + row * (tileHeight + spacing),
          tileWidth,
          tileHeight,
        );

        const sprite: Sprite = new Sprite(texture, {
          rect,
          pivot: options.pivot,
        });

        this.tiles.push(new Tile(index, sprite));
      }
    }
  }

  public get count(): number {
    return this.tiles.length;
  }

  public getTile(index: number): Tile {
    const tile: Tile | undefined = this.tiles[index];
    if (tile === undefined) {
      throw new Error(
        `TileSet index ${index} out of range [0, ${this.count}).`,
      );
    }
    return tile;
  }

  public tryGetTile(index: number): Tile | undefined {
    return this.tiles[index];
  }

  public indexOf(col: number, row: number): number {
    return row * this.columns + col;
  }

  public destroy(): void {}
}
