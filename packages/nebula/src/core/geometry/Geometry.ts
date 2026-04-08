import { VertexBuffer, IndexBuffer } from "../buffers";
import { Disposable } from "../utils";
import { Primitive } from "./Primitive";

export interface Geometry extends Disposable {
  readonly __kind: string;

  readonly primitive: Primitive;
  readonly vertexBuffer: VertexBuffer;
  readonly indexBuffer: IndexBuffer;
}
