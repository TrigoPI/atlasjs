import type { TiledMap } from "./map-object/tiled.type";

import {
  Layer,
  LayerManager,
  MapObjectManager,
  MapObject,
  TileSet,
  TileSetManager,
  type SerializedTile,
  type TileIndex,
  type TilePosition,
} from "./map-object";

export class MapLoader {
  private readonly map: TiledMap;

  private readonly layers: LayerManager;
  private readonly tileSetManager: TileSetManager;
  private readonly objectManager: MapObjectManager;

  public constructor(map: Record<string, unknown>) {
    this.map = map as TiledMap;
    this.tileSetManager = new TileSetManager(this.map);
    this.objectManager = new MapObjectManager(this.map);
    this.layers = new LayerManager(this.map);
  }

  public getObject<T extends MapObject>(name: string): T | undefined {
    return this.objectManager.getObject(name);
  }

  public getSerializedLayer(layerName: string) {
    const layer: Layer | undefined = this.layers.getLayer(layerName);
    const result: SerializedTile[] = [];

    if (!layer) {
      throw new Error(`Layer '${layerName}' not found`);
    }

    for (const tileData of layer.data) {
      if (tileData.id === 0) {
        continue;
      }

      const tileSet: TileSet | undefined = this.tileSetManager.getTileSetForId(
        tileData.id,
      );

      if (!tileSet) {
        console.log(`TileSet not found for id ${tileData.id}`);
        continue;
      }

      const tileIndexes: TileIndex = tileSet.getId(tileData.id);
      const tileIndex: number = tileIndexes.y * tileSet.columns + tileIndexes.x;
      const position: TilePosition = {
        cx: tileData.position.cx,
        cy: tileData.position.cy,
      };

      result.push({
        position,
        tileIndex,
        tilesetId: tileSet.name,
      });
    }

    return result;
  }
}
