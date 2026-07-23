import { Vec2 } from "@atlasjs/math";

export class Grid {
  public cellSize: Vec2;
  public cellGap: Vec2;

  public constructor(cellSize: Vec2, cellGap: Vec2 = new Vec2(0, 0)) {
    this.cellSize = cellSize;
    this.cellGap = cellGap;
  }
}
