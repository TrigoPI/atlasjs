import { IndexFormat } from "../core-types";
import { Disposable } from "../utils";

export interface IndexBuffer extends Disposable {
  readonly data: Uint16Array | Uint32Array;
  readonly format: IndexFormat;
  readonly count: number;
  readonly size: number;
}
