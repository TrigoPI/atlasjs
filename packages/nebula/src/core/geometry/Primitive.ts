import { VertexBufferLayout } from "../buffers";
import { IndexFormat } from "../core-types";

export interface Primitive {
  readonly vertices: Float32Array;
  readonly vertexLayout: VertexBufferLayout;
  readonly vertexCount: number;

  readonly indices: Uint16Array;
  readonly indexCount: number;
  readonly indexFormat: IndexFormat;
}
