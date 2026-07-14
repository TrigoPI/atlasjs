import { Disposable } from "@atlasjs/nebula";
import { WebGPUPipeline } from "../pipeline";

export class WebGPUPipelineCache implements Disposable {
  private readonly pipelines: Map<string, WebGPUPipeline>;

  public constructor() {
    this.pipelines = new Map<string, WebGPUPipeline>();
  }

  public getOrCreate(key: string, create: () => WebGPUPipeline): WebGPUPipeline {
    let pipeline: WebGPUPipeline | undefined = this.pipelines.get(key);

    if (!pipeline) {
      pipeline = create();
      this.pipelines.set(key, pipeline);
    }

    return pipeline;
  }

  public destroy(): void {
    for (const pipeline of this.pipelines.values()) {
      pipeline.destroy();
    }

    this.pipelines.clear();
  }
}
