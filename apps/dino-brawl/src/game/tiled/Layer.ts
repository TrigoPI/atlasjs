import type { TileData } from "./map.types";

export class Layer {
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
