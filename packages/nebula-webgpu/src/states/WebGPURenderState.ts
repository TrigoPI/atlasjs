import { WebGPUGeometry } from "../geometry";
import { WebGPUShader } from "../material";
import { WebGPUPipeline } from "../pipeline";
import { WebGPUVertexBuffer, WebGPUIndexBuffer } from "../buffers";

export class WebGPURenderState {
  public pipeline?: WebGPUPipeline;
  public shader?: WebGPUShader;
  public geometry?: WebGPUGeometry;
  public vertexBuffer?: WebGPUVertexBuffer;
  public indexBuffer?: WebGPUIndexBuffer;

  public readonly bindGroups: Map<number, GPUBindGroup>;

  public constructor() {
    this.bindGroups = new Map();
  }

  public reset(): void {
    this.pipeline = undefined;
    this.shader = undefined;
    this.geometry = undefined;
    this.vertexBuffer = undefined;
    this.indexBuffer = undefined;
    this.bindGroups.clear();
  }
}
