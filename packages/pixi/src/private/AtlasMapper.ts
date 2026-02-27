import { Mat2 } from "@atlasjs/math";
import { Matrix } from "pixi.js";

export class AtlasMapper {
  public static mat2ToPixiMatrix(m: Mat2, out: Matrix): Matrix {
    return out.set(m.a, m.b, m.c, m.d, m.tx, m.ty);
  }
}
