import type { TileSetConstructorData, TileIndex } from "./map.types";

export class TileSet {
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
    this.tileWidth = data.tileWidth;
    this.tileHeight = data.tileHeight;
    this.firstGid = data.firstGid;
    this.lastGid = this.firstGid + this.tileCount - 1;
  }

  public getId(id: number): TileIndex {
    const localId: number = id - this.firstGid;

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
