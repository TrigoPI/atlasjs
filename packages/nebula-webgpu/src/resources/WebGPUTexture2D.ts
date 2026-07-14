import { IDGenerator, RenderTarget, TextureFormat } from "@atlasjs/nebula";
import { WebGPUTexture2DOptions } from "../webgpu-types";

const DEFAULT_FORMAT: TextureFormat = "rgba8unorm";

export class WebGPUTexture2D implements RenderTarget {
  public readonly __kind: string = "webgpu";
  public readonly id: string;

  public readonly width: number;
  public readonly height: number;
  public readonly format: TextureFormat;

  public readonly texture: GPUTexture;
  public readonly view: GPUTextureView;

  public constructor(device: GPUDevice, options: WebGPUTexture2DOptions) {
    this.id = options.id || IDGenerator.createTextureId();

    this.width = options.width;
    this.height = options.height;
    this.format = options.format ?? DEFAULT_FORMAT;

    this.texture = this.createTexture(device, this.format);
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
