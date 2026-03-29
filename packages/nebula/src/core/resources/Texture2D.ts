import { Disposable } from "../utils";

export interface Texture2D extends Disposable {
  readonly __kind: string;
  readonly width: number;
  readonly height: number;
  readonly id: string;
}
