import { Bound, Box2 } from "@atlasjs/math";
import { Clock, Logger, createLogger } from "@atlasjs/utils";

import { WebGPUGuard } from "./utils";
import { WebGPUGeometry } from "./geometry";
import { WebGPUPipeline } from "./pipeline";
import { WebGPURenderContext } from "./states";
import {
  WebGPUBindingGroupCache,
  WebGPUPipelineCache,
  WebGPUShaderCache,
} from "./caches";
import { WebGPUSampler, WebGPUTexture2D } from "./resources";
import { WebGPUShader, WebGPUMaterial } from "./material";
import { WebGPUShaders } from "./resources";
import { WebGPUReflection, WebGPUReflectedGroup } from "./reflect";

import {
  BINDING_GROUP_GLOBAL,
  BINDING_GROUP_MATERIAL,
  BINDING_GROUP_OBJECT,
} from "./web-gpu-const";

import {
  WebGPUBinder,
  WebGPUBindingGroup,
  WebGPUBindingGroupDefinition,
  WebGPUCompiledBindingGroup,
} from "./bindings";

import {
  Renderer,
  Quad,
  Shader,
  VertexBufferLayout,
  SamplerDescriptor,
  ShaderDescriptor,
  IndexFormat,
  Primitive,
  Texture2DDescriptor,
  Geometry,
  Material,
  Camera2D,
  UniformType,
  BindingGroup,
  BindingGroupDefinition,
  RenderState,
  DEFAULT_RENDER_STATE,
} from "@atlasjs/nebula";

import {
  WebGPUUniformBuffer,
  WebGPUVertexBuffer,
  WebGPUIndexBuffer,
} from "./buffers";

export class WebGPURenderer implements Renderer {
  public readonly __kind: string = "webgpu";
  public readonly camera: Camera2D;

  private readonly logger: Logger;
  private readonly binder: WebGPUBinder;

  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private bindingGroupCache!: WebGPUBindingGroupCache;
  private shaderCache!: WebGPUShaderCache;
  private pipelineCache!: WebGPUPipelineCache;
  private globalBindings!: WebGPUBindingGroup;

  private clock: Clock;

  private currentRenderContext?: WebGPURenderContext;

  constructor(canvas: HTMLCanvasElement) {
    this.logger = createLogger("WebGPURenderer");
    this.canvas = canvas;

    this.clock = new Clock();
    this.camera = new Camera2D();
    this.binder = new WebGPUBinder();
  }

  public destroy(): void {
    this.shaderCache.destroy();
    this.bindingGroupCache.destroy();
    this.pipelineCache.destroy();
  }

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

  private getOrCreatePipeline(
    shader: WebGPUShader,
    geometry: WebGPUGeometry,
    renderState: RenderState,
  ): WebGPUPipeline {
    const topology: GPUPrimitiveTopology = "triangle-list";

    const key: string = [
      shader.id,
      geometry.vertexBuffer.layout.getId(),
      this.format,
      topology,
      renderState.blend,
      renderState.cull,
      renderState.depthTest ? "d" : "n",
    ].join("|");

    return this.pipelineCache.getOrCreate(key, () =>
      this.buildPipeline(shader, geometry, renderState, topology),
    );
  }

  private buildPipeline(
    shader: WebGPUShader,
    geometry: WebGPUGeometry,
    renderState: RenderState,
    topology: GPUPrimitiveTopology,
  ): WebGPUPipeline {
    const globalGroup: GPUBindGroupLayout =
      this.bindingGroupCache.getOrCreateGPULayout(shader.globalDefinition);

    const objectGroup: GPUBindGroupLayout =
      this.bindingGroupCache.getOrCreateGPULayout(shader.objectDefinition);

    const materialGroup: GPUBindGroupLayout =
      this.bindingGroupCache.getOrCreateGPULayout(shader.materialDefinition);

    const bindGroupLayouts: GPUBindGroupLayout[] = [
      globalGroup,
      objectGroup,
      materialGroup,
    ];

    const layout: GPUPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts,
    });

    return new WebGPUPipeline(this.device, {
      topology,
      layout,
      bindGroupLayouts,
      renderState,
      format: this.format,
      geometry,
      shader,
    });
  }

  public createUniformBuffer(type: UniformType): WebGPUUniformBuffer {
    return new WebGPUUniformBuffer(this.device, type);
  }

  public createSampler(descriptor?: SamplerDescriptor): WebGPUSampler {
    return new WebGPUSampler(this.device, descriptor);
  }

  public createShader(definition: ShaderDescriptor): WebGPUShader {
    return this.shaderCache.getOrCreate(definition);
  }

  public createSpriteShader(): WebGPUShader {
    return this.createShader(WebGPUShaders.Texture2D);
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

  public createBindingGroup(
    definition: BindingGroupDefinition,
  ): WebGPUBindingGroup {
    WebGPUGuard.assertWebGPUBindingGroupDefinition(definition);
    return new WebGPUBindingGroup(definition);
  }

  public createMaterial(
    shader: Shader,
    renderState: RenderState = DEFAULT_RENDER_STATE,
  ): WebGPUMaterial {
    WebGPUGuard.assertWebGPUShader(shader);
    return new WebGPUMaterial(shader, renderState);
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

    // prettier-ignore
    const globalReflected: WebGPUReflectedGroup =
      WebGPUReflection.reflect(WebGPUShaders.Global.source).groups.get(BINDING_GROUP_GLOBAL) ?? 
      WebGPUReflection.emptyGroup(BINDING_GROUP_GLOBAL);

    const globalBindingsDefinition: WebGPUBindingGroupDefinition =
      new WebGPUBindingGroupDefinition("atlas.global", globalReflected);

    this.device = device;
    this.context = context;
    this.format = format;

    this.globalBindings = new WebGPUBindingGroup(globalBindingsDefinition);
    this.bindingGroupCache = new WebGPUBindingGroupCache(this.device);
    this.shaderCache = new WebGPUShaderCache(this.device);
    this.pipelineCache = new WebGPUPipelineCache();

    this.logger.log("WebGPURenderer initialized successfully.");
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
    this.updateTime();
  }

  public draw(
    geometry: Geometry,
    material: Material,
    bindings: BindingGroup,
  ): void {
    const ctx: WebGPURenderContext = this.assertContext();

    const geo: WebGPUGeometry = geometry as WebGPUGeometry;
    const mat: WebGPUMaterial = material as WebGPUMaterial;
    const binds: WebGPUBindingGroup = bindings as WebGPUBindingGroup;

    if (__DEV__) {
      WebGPUGuard.assertWebGPUGeometry(geometry);
      WebGPUGuard.assertWebGPUMaterial(material);
      WebGPUGuard.assertWebGPUBindingGroup(bindings);
    }

    const pipe: WebGPUPipeline = this.getOrCreatePipeline(
      mat.shader,
      geo,
      mat.renderState,
    );

    this.bindPipeline(ctx, pipe);
    this.bindGlobalGroup(ctx, pipe);
    this.bindObjectGroup(ctx, binds, pipe);
    this.bindMaterial(ctx, mat, pipe);
    this.bindGeometryAndDrawIndexed(ctx, geo);
  }

  public endFrame(): void {
    const context: WebGPURenderContext = this.assertContext();
    context.renderPass.end();
    this.device.queue.submit([context.commandEncoder.finish()]);
    this.currentRenderContext = undefined;
  }

  private updateCamera(): void {
    const width: number = this.canvas.width;
    const height: number = this.canvas.height;
    this.camera.update(width, height);
    this.globalBindings.set("viewProjection", this.camera.viewProjection);
  }

  private updateTime(): void {
    const time: number = this.clock.getTimeSecond();
    this.globalBindings.set("time", time);
  }

  private bindPipeline(
    ctx: WebGPURenderContext,
    pipeline: WebGPUPipeline,
  ): void {
    this.binder.bindPipeline(ctx, pipeline);
  }

  private bindGlobalGroup(
    ctx: WebGPURenderContext,
    pipeline: WebGPUPipeline,
  ): void {
    const globalBindGroupLayout: GPUBindGroupLayout =
      pipeline.getBindGroupLayout(BINDING_GROUP_GLOBAL);

    const compiledGlobalBindings: WebGPUCompiledBindingGroup =
      this.bindingGroupCache.get(this.globalBindings, globalBindGroupLayout);

    this.assertBindGroup(compiledGlobalBindings.bindGroup);

    this.binder.bindGroup(
      ctx,
      BINDING_GROUP_GLOBAL,
      compiledGlobalBindings.bindGroup,
    );
  }

  private bindObjectGroup(
    ctx: WebGPURenderContext,
    bindings: WebGPUBindingGroup,
    pipeline: WebGPUPipeline,
  ): void {
    const objectBindGroupLayout: GPUBindGroupLayout =
      pipeline.getBindGroupLayout(BINDING_GROUP_OBJECT);

    const compiledObjectBindings: WebGPUCompiledBindingGroup =
      this.bindingGroupCache.get(bindings, objectBindGroupLayout);

    this.assertBindGroup(compiledObjectBindings.bindGroup);

    this.binder.bindGroup(
      ctx,
      BINDING_GROUP_OBJECT,
      compiledObjectBindings.bindGroup,
    );
  }

  private bindMaterial(
    ctx: WebGPURenderContext,
    material: WebGPUMaterial,
    pipeline: WebGPUPipeline,
  ): void {
    const materialBindGroupLayout: GPUBindGroupLayout =
      pipeline.getBindGroupLayout(BINDING_GROUP_MATERIAL);

    const compiledMaterial: WebGPUCompiledBindingGroup =
      this.bindingGroupCache.get(
        material.bindingGroup,
        materialBindGroupLayout,
      );

    this.assertBindGroup(compiledMaterial.bindGroup);
    this.binder.bindGroup(
      ctx,
      compiledMaterial.layout.group,
      compiledMaterial.bindGroup,
    );
  }

  private bindGeometryAndDrawIndexed(
    ctx: WebGPURenderContext,
    geometry: WebGPUGeometry,
  ): void {
    this.binder.bindGeometry(ctx, geometry);
    ctx.renderPass.drawIndexed(geometry.primitive.indexCount);
  }

  private assertBindGroup(
    bindGroup: GPUBindGroup | null,
  ): asserts bindGroup is GPUBindGroup {
    if (!bindGroup) {
      throw new Error("Invalid bind group.");
    }
  }

  private assertContext(): WebGPURenderContext {
    if (!this.currentRenderContext) {
      throw new Error("No active frame. Call beginFrame() first.");
    }

    return this.currentRenderContext;
  }
}
