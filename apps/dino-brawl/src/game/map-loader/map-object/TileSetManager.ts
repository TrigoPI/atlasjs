import type { TiledMap } from "./tiled.type";
import { TileSet } from "./TileSet";

export class TileSetManager {
  private readonly tileSets: Record<string, TileSet>;

  public constructor(map: TiledMap) {
    this.tileSets = this.getTileSets(map);
  }

  public getTileSetForId(id: number): TileSet | undefined {
    return Object.values(this.tileSets).find((tileSet: TileSet) =>
      tileSet.isIdIn(id),
    );
  }

  private getTileSets(map: TiledMap): Record<string, TileSet> {
    const result: Record<string, TileSet> = {};
    for (const tileSet of map.tilesets) {
      result[tileSet.name] = new TileSet({
        name: tileSet.name,
        columns: tileSet.columns,
        imageHeight: tileSet.imageheight,
        imageWidth: tileSet.imagewidth,
        tileWidth: tileSet.tilewidth,
        tileHeight: tileSet.tileheight,
        tileCount: tileSet.tilecount,
        firstGid: tileSet.firstgid,
      });
    }

    return result;
  }
}
