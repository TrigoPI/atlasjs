import { Disposable } from "../utils";
import { VertexBufferLayout } from "./VertexBufferLayout";

export interface VertexBuffer extends Disposable {
  readonly __kind: string;

  readonly layout: VertexBufferLayout;
  readonly data: Float32Array;

  getSize(): number;
  getStride(): number;
}
