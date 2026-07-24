import type { TiledLayer, TiledMap } from "./tiled.type";

export type TileSetConstructorData = {
  name: string;
  columns: number;
  imageHeight: number;
  imageWidth: number;
  tileWidth: number;
  tileHeight: number;
  tileCount: number;
  firstGid: number;
};

export type TileIndex = {
  x: number;
  y: number;
};

export type TileData = {
  position: TilePosition;
  id: number;
};

export type TilePosition = {
  cx: number;
  cy: number;
};

export type SerializedTile = {
  position: TilePosition;
  tileIndex: number;
  tilesetId: string;
};

export class MapLoader {
  private readonly map: TiledMap;

  private readonly layers: Record<string, Layer>;
  private readonly tileSetManager: TileSetManager;

  public constructor(map: Record<string, unknown>) {
    this.map = map as TiledMap;
    this.tileSetManager = new TileSetManager(this.map);
    this.layers = this.getLayers(this.map.layers);
  }

  public getSerializedLayer(layerName: string) {
    const layer: Layer | undefined = this.layers[layerName];
    const result: SerializedTile[] = [];

    if (!layer) {
      throw new Error(`Layer '${layerName}' not found`);
    }

    for (const tileData of layer.data) {
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

  private getLayers(
    layers: TiledLayer[],
    input: Record<string, Layer> = {},
  ): Record<string, Layer> {
    const result: Record<string, Layer> = input;

    for (const layer of layers) {
      if (layer.type === "group") {
        this.getLayers(layer.layers, input);
      }

      if (layer.type === "tilelayer") {
        result[layer.name] = new Layer(layer.name, layer.data, this.map.width);
      }
    }

    return result;
  }
}

class Layer {
  public readonly name: string;
  public readonly data: TileData[];

  public constructor(name: string, data: number[], columns: number) {
    this.name = name;
    this.data = this.getTileData(data, columns);
  }

  private getTileData(data: number[], columns: number): TileData[] {
    return data.map((id, index) => ({
      position: {
        cx: index % columns,
        cy: Math.floor(index / columns),
      },
      id,
    }));
  }
}

class TileSetManager {
  private readonly tileSets: Record<string, TileSet>;

  public constructor(map: TiledMap) {
    this.tileSets = this.getTileSets(map);
  }

  public getTileSetForId(id: number): TileSet | undefined {
    return Object.values(this.tileSets).find((tileSet) => tileSet.isIdIn(id));
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

class TileSet {
  public readonly name: string;
  public readonly columns: number;
  public readonly imageHeight: number;
  public readonly imageWidth: number;
  public readonly tileCount: number;
  public readonly firstGid: number;
  public readonly tileWidth: number;
  public readonly tileHeight: number;
  public readonly lastGid: number;

  public constructor(data: TileSetConstructorData) {
    this.name = data.name;
    this.columns = data.columns;
    this.imageHeight = data.imageHeight;
    this.imageWidth = data.imageWidth;
    this.tileCount = data.tileCount;
    this.firstGid = data.firstGid - 1;
    this.lastGid = this.firstGid + data.tileCount - 1;
  }

  public getId(id: number): TileIndex {
    const localId: number = id - 1 - this.firstGid;

    if (localId < 0) {
      throw new Error(`getId: id ${id} is before firstGid ${this.firstGid}`);
    }

    if (localId >= this.tileCount) {
      throw new Error(`getId: id ${id} is after lastGid ${this.lastGid}`);
    }

    const x: number = localId % this.columns;
    const y: number = this.columns - 1 - Math.floor(localId / this.columns);

    return { x, y };
  }

  public isIdIn(id: number): boolean {
    return id >= this.firstGid && id <= this.lastGid;
  }
}
