import { WebGPUGeometry } from "../geometry";
import { WebGPUMaterial, WebGPUBindings } from "../bindings";
import { WebGPUVertexBuffer, WebGPUIndexBuffer } from "../buffers";
import { WebGPUPipeline, WebGPUShader } from "../pipeline";

export class WebGPURenderState {
  public pipeline?: WebGPUPipeline;
  public shader?: WebGPUShader;
  public geometry?: WebGPUGeometry;
  public vertexBuffer?: WebGPUVertexBuffer;
  public indexBuffer?: WebGPUIndexBuffer;

  public material?: WebGPUMaterial;
  public objectBindings?: WebGPUBindings;

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
    this.material = undefined;
    this.objectBindings = undefined;
    this.bindGroups.clear();
  }
}
