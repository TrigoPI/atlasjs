import { Bound, Box2 } from "@atlasjs/math";
import { Logger, createLogger } from "@atlasjs/utils";

import { WebGPUShaderCache } from "./caches";
import { WebGPUGeometry } from "./geometry";
import { WebGPUPipeline, WebGPUShader } from "./pipeline";
import { WebGPUSampler, WebGPUTexture2D } from "./resources";
import { WebGPURenderContext } from "./states";
import { WebGPUGuard } from "./utils";

import {
  Renderer,
  Quad,
  Shader,
  VertexBufferLayout,
  VertexAttributeFormat,
  SamplerDescriptor,
  ShaderDefinition,
  IndexFormat,
  Pipeline,
  Texture2D,
  Sampler,
  Primitive,
  Texture2DDescriptor,
  Geometry,
  Material,
  ObjectBinding,
  Camera2D,
} from "../core";

import {
  WebGPUBinder,
  WebGPUGlobalBindings,
  WebGPUObjectBindings,
  WebGPUMaterial,
  WebGPUBindings,
} from "./bindings";

import {
  WebGPUUniformBuffer,
  WebGPUVertexBuffer,
  WebGPUIndexBuffer,
} from "./buffers";

import {
  BINDING_LOCATION_TEXTURE,
  BINDING_LOCATION_SAMPLER,
  UNIFORM_GLOBALS,
  BINDING_GROUP_GLOBAL,
} from "./web-gpu-const";

export class WebGPURenderer implements Renderer {
  public readonly __kind: string = "webgpu";
  public readonly camera: Camera2D;

  private readonly logger: Logger;
  private readonly binder: WebGPUBinder;

  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;
  private shaderCache!: WebGPUShaderCache;
  private globalBindings!: WebGPUGlobalBindings;

  private currentRenderContext?: WebGPURenderContext;

  constructor(canvas: HTMLCanvasElement) {
    this.logger = createLogger("WebGPURenderer");
    this.canvas = canvas;

    this.camera = new Camera2D();
    this.binder = new WebGPUBinder();
  }

  public destroy(): void {}

  public getViewport(): Box2 {
    return Box2.create(this.canvas.width, this.canvas.height);
  }

  public getCameraViewport(): Bound {
    const width = this.canvas.width / this.camera.zoom;
    const height = this.canvas.height / this.camera.zoom;
    return Bound.create(
      this.camera.position.x,
      this.camera.position.y,
      width,
      height,
    );
  }

  public getDevice(): GPUDevice {
    return this.device;
  }

  public getContext(): GPUCanvasContext {
    return this.context;
  }

  public getCanvasFormat(): GPUTextureFormat {
    return this.format;
  }

  public createQuad(): WebGPUGeometry {
    const quad: Quad = new Quad();
    return this.createGeometry(quad);
  }

  public createPipeline(
    shader: Shader,
    vertexLayout: VertexBufferLayout,
  ): WebGPUPipeline {
    const topology: GPUPrimitiveTopology = "triangle-list";
    const webGPUShader: WebGPUShader = WebGPUGuard.asWebGPUShader(shader);

    return new WebGPUPipeline(this.device, {
      topology,
      vertexLayout,
      alphaBlend: true,
      format: this.format,
      shader: webGPUShader,
    });
  }

  public createUniformBuffer(type: VertexAttributeFormat): WebGPUUniformBuffer {
    return new WebGPUUniformBuffer(this.device, type);
  }

  public createSampler(descriptor?: SamplerDescriptor): WebGPUSampler {
    return new WebGPUSampler(this.device, descriptor);
  }

  public createShader(definition: ShaderDefinition): WebGPUShader {
    return this.shaderCache.getOrCreate(definition);
  }

  public createObjectBindings(pipeline: WebGPUPipeline): WebGPUObjectBindings {
    return new WebGPUObjectBindings(this.device, pipeline);
  }

  public createVertexBuffer(
    data: Float32Array,
    layout: VertexBufferLayout,
  ): WebGPUVertexBuffer {
    return new WebGPUVertexBuffer(this.device, data, layout);
  }

  public createIndexBuffer(
    data: Uint16Array | Uint32Array,
    format: IndexFormat,
  ): WebGPUIndexBuffer {
    return new WebGPUIndexBuffer(this.device, data, format);
  }

  public createMaterial(pipeline: Pipeline): WebGPUMaterial {
    const webGPUPipeline: WebGPUPipeline =
      WebGPUGuard.asWebGPUPipeline(pipeline);

    return new WebGPUMaterial(this.device, webGPUPipeline);
  }

  public createTexturedMaterial(
    pipeline: Pipeline,
    texture: Texture2D,
    sampler: Sampler,
  ): WebGPUMaterial {
    const webGPUSampler: WebGPUSampler = WebGPUGuard.asWebGPUSampler(sampler);
    const webGPUTexture: WebGPUTexture2D =
      WebGPUGuard.asWebGPUTexture2D(texture);

    const webGPUPipeline: WebGPUPipeline =
      WebGPUGuard.asWebGPUPipeline(pipeline);

    const material: WebGPUMaterial = new WebGPUMaterial(
      this.device,
      webGPUPipeline,
    );

    material.bindTexture2D(BINDING_LOCATION_TEXTURE, webGPUTexture);
    material.bindSampler(BINDING_LOCATION_SAMPLER, webGPUSampler);

    return material;
  }

  public createGeometry(primitive: Primitive): WebGPUGeometry {
    const vertexBuffer: WebGPUVertexBuffer = this.createVertexBuffer(
      primitive.vertices,
      primitive.vertexLayout,
    );

    const indexBuffer: WebGPUIndexBuffer = this.createIndexBuffer(
      primitive.indices,
      primitive.indexFormat,
    );

    return new WebGPUGeometry(primitive, vertexBuffer, indexBuffer);
  }

  public createTexture2D({
    width,
    height,
    source,
    format,
  }: Texture2DDescriptor): WebGPUTexture2D {
    return new WebGPUTexture2D(this.device, {
      width,
      height,
      format,
      source,
    });
  }

  public async init(): Promise<void> {
    this.logger.log("Initializing WebGPURenderer...");

    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported in this browser.");
    }

    this.logger.log("Requesting GPU adapter...");
    const adapter: GPUAdapter | null = await navigator.gpu.requestAdapter();

    if (!adapter) {
      throw new Error("Failed to get GPU adapter.");
    }

    this.logger.log("Requesting GPU device...");
    const device: GPUDevice = await adapter.requestDevice();

    this.logger.log("Configuring canvas context...");
    const context: GPUCanvasContext | null = this.canvas.getContext("webgpu");

    if (!context) {
      throw new Error("Failed to get WebGPU context.");
    }

    const format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
      device,
      format,
      alphaMode: "premultiplied",
    });

    this.device = device;
    this.context = context;
    this.format = format;

    this.globalBindings = new WebGPUGlobalBindings(this.device);
    this.shaderCache = new WebGPUShaderCache(this.device);

    this.globalBindings.bindUniform(
      UNIFORM_GLOBALS.camera.name,
      UNIFORM_GLOBALS.camera.binding,
      UNIFORM_GLOBALS.camera.type,
    );

    this.logger.log("WebGPURenderer initialized successfully.");
  }

  public updateCamera(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.camera.update(width, height);
    this.globalBindings.setMat4(
      UNIFORM_GLOBALS.camera.name,
      this.camera.viewProjection,
    );
  }

  public beginFrame(): void {
    const commandEncoder: GPUCommandEncoder =
      this.device.createCommandEncoder();

    const textureView: GPUTextureView = this.context
      .getCurrentTexture()
      .createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    this.currentRenderContext = new WebGPURenderContext({
      commandEncoder,
      renderPass,
      textureView,
    });

    this.updateCamera();
  }

  public draw(
    geometry: Geometry,
    pipeline: Pipeline,
    material: Material,
    bindings: ObjectBinding,
  ): void {
    const ctx: WebGPURenderContext = this.assertContext();
    const webGPUGeo: WebGPUGeometry = WebGPUGuard.asWebGPUGeometry(geometry);
    const webGPUBinding: WebGPUBindings = WebGPUGuard.asWebGPUBinding(
      bindings.bindings,
    );

    const webGPUPipeline: WebGPUPipeline =
      WebGPUGuard.asWebGPUPipeline(pipeline);

    const cameraBindGroup: GPUBindGroup =
      this.globalBindings.getBindGroup(webGPUPipeline);

    this.assertGeometryCompatibleWithPipeline(webGPUGeo, webGPUPipeline);

    this.binder.bindPipeline(ctx, webGPUPipeline);
    this.binder.bindGroup(ctx, BINDING_GROUP_GLOBAL, cameraBindGroup);
    this.binder.bindObject(ctx, webGPUBinding);

    if (material) {
      const webGPUMaterial: WebGPUMaterial =
        WebGPUGuard.asWebGPUMaterial(material);
      this.binder.bindMaterial(ctx, webGPUMaterial);
    }

    this.binder.bindGeometry(ctx, webGPUGeo);
    ctx.renderPass.drawIndexed(webGPUGeo.primitive.indexCount);
  }

  public endFrame(): void {
    const context: WebGPURenderContext = this.assertContext();
    context.renderPass.end();
    this.device.queue.submit([context.commandEncoder.finish()]);
    this.currentRenderContext = undefined;
  }

  private assertContext(): WebGPURenderContext {
    if (!this.currentRenderContext) {
      throw new Error("No active frame. Call beginFrame() first.");
    }

    return this.currentRenderContext;
  }

  private assertGeometryCompatibleWithPipeline(
    geometry: WebGPUGeometry,
    pipeline: WebGPUPipeline,
  ): void {
    const geometryLayoutId: string = geometry.vertexBuffer.layout.getId();
    const pipelineLayoutId: string = pipeline.descriptor.vertexLayout.getId();

    if (geometryLayoutId !== pipelineLayoutId) {
      throw new Error(
        `Geometry layout '${geometryLayoutId}' is incompatible with pipeline '${pipeline.id}'. Expected '${pipelineLayoutId}'.`,
      );
    }
  }
}
