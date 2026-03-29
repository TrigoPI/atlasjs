import { VertexBufferLayout } from "../buffers";
import { IndexFormat } from "../core-types";
import { Primitive } from "./Primitive";

//prettier-ignore
export class Quad implements Primitive {
  public readonly vertices: Float32Array;
  public readonly vertexLayout: VertexBufferLayout;
  public readonly vertexCount: number;

  public readonly indices: Uint16Array;
  public readonly indexCount: number;
  public readonly indexFormat: IndexFormat;

  public constructor() {
    this.indexFormat = "uint16"
    this.vertexCount = 4;
    this.indexCount = 6;

    this.vertices = this.getVertices();
    this.indices = this.getIndices();
    this.vertexLayout = this.getVertexLayout();
  }

  private getVertices(): Float32Array {
    return new Float32Array([
      // x,    y,   u,   v
      -0.5,  0.5, 0.0, 0.0, // top-left
       0.5,  0.5, 1.0, 0.0, // top-right
      -0.5, -0.5, 0.0, 1.0, // bottom-left
       0.5, -0.5, 1.0, 1.0, // bottom-right
    ]);
  }

  private getIndices(): Uint16Array {
    return new Uint16Array([
      0, 1, 2,
      2, 1, 3
    ]);
  }

  private getVertexLayout(): VertexBufferLayout {
    return VertexBufferLayout.create().addAttribute("vec2", 0).addAttribute("vec2", 1);
  }
}
