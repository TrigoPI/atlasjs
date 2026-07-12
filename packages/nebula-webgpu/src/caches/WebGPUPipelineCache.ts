import { WebGPUPipeline } from "../pipeline";

export class WebGPUPipelineCache {
  private readonly device: GPUDevice;
  private readonly pipelines: Map<string, WebGPUPipeline>;

  public constructor(device: GPUDevice) {
    this.device = device;
    this.pipelines = new Map<string, WebGPUPipeline>();
  }
}
