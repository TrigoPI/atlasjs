import type { TileSet } from "../assets/TileSet";

const KEY_OFFSET: number = 32768;
const KEY_STRIDE: number = 65536;

export class TileMap {
  public readonly tileset: TileSet;

  private readonly cells: Map<number, number>;
  private currentRevision: number;

  public constructor(tileset: TileSet) {
    this.tileset = tileset;
    this.cells = new Map<number, number>();
    this.currentRevision = 0;
  }

  public get revision(): number {
    return this.currentRevision;
  }

  public setTile(cx: number, cy: number, tileIndex: number): void {
    if (tileIndex < 0) {
      this.removeTile(cx, cy);
      return;
    }
    this.cells.set(this.key(cx, cy), tileIndex);
    this.currentRevision++;
  }

  public getTile(cx: number, cy: number): number {
    const value: number | undefined = this.cells.get(this.key(cx, cy));
    return value === undefined ? -1 : value;
  }

  public hasTile(cx: number, cy: number): boolean {
    return this.cells.has(this.key(cx, cy));
  }

  public removeTile(cx: number, cy: number): void {
    if (this.cells.delete(this.key(cx, cy))) {
      this.currentRevision++;
    }
  }

  public fill(cx0: number, cy0: number, cx1: number, cy1: number, tileIndex: number): void {
    const xMin: number = Math.min(cx0, cx1);
    const xMax: number = Math.max(cx0, cx1);
    const yMin: number = Math.min(cy0, cy1);
    const yMax: number = Math.max(cy0, cy1);

    for (let cy: number = yMin; cy <= yMax; cy++) {
      for (let cx: number = xMin; cx <= xMax; cx++) {
        this.setTile(cx, cy, tileIndex);
      }
    }
  }

  public clear(): void {
    if (this.cells.size > 0) {
      this.cells.clear();
      this.currentRevision++;
    }
  }

  public forEachTile(fn: (cx: number, cy: number, tileIndex: number) => void): void {
    for (const [packed, index] of this.cells) {
      const cx: number = Math.floor(packed / KEY_STRIDE) - KEY_OFFSET;
      const cy: number = (packed % KEY_STRIDE) - KEY_OFFSET;
      fn(cx, cy, index);
    }
  }

  private key(cx: number, cy: number): number {
    return (cx + KEY_OFFSET) * KEY_STRIDE + (cy + KEY_OFFSET);
  }
}
