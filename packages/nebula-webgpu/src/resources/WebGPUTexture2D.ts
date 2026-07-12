import { IDGenerator, Texture2D } from "@atlasjs/nebula";
import { WebGPUTexture2DOptions } from "../webgpu-types";

export class WebGPUTexture2D implements Texture2D {
  public readonly __kind: string = "webgpu";
  public readonly id: string;

  public readonly width: number;
  public readonly height: number;

  public readonly texture: GPUTexture;
  public readonly view: GPUTextureView;

  public constructor(device: GPUDevice, options: WebGPUTexture2DOptions) {
    this.id = options.id || IDGenerator.createTextureId();

    this.width = options.width;
    this.height = options.height;

    this.texture = this.createTexture(device, options.format);
    this.view = this.texture.createView();

    if (options.source) {
      device.queue.copyExternalImageToTexture(
        { source: options.source },
        { texture: this.texture },
        { width: this.width, height: this.height },
      );
    }
  }

  public destroy(): void {
    this.texture.destroy();
  }

  private createTexture(
    device: GPUDevice,
    format: GPUTextureFormat | undefined,
  ): GPUTexture {
    return device.createTexture({
      dimension: "2d",
      format: format || "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
      size: {
        width: this.width,
        height: this.height,
        depthOrArrayLayers: 1,
      },
    });
  }
}
