import { Bound } from "@atlasjs/math";
import { Clock, Logger, createLogger } from "@atlasjs/utils";

import { WebGPUGuard } from "./utils";
import { WebGPUGeometry } from "./geometry";
import { WebGPUPipeline, WebGPUPipelineFactory } from "./pipeline";

import { WebGPURenderContext } from "./states";
import { WebGPUSampler, WebGPUTexture2D } from "./resources";
import { WebGPUShader, WebGPUMaterial } from "./material";
import { WebGPUShaders, WebGPUBuiltinShaders } from "./resources";
import { WebGPUReflection, WebGPUReflectedGroup } from "./reflect";

import {
  WebGPUSpriteBatch,
  WebGPUShapeBatch,
  WebGPUInstancedBatch,
  WebGPUInstanceBufferPool,
} from "./batch";

import {
  WebGPUBindingGroupCache,
  WebGPUShaderCache,
} from "./caches";

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
  InstancedBatch,
  PassDescriptor,
  RenderTargetDescriptor,
  Color,
} from "@atlasjs/nebula";

import {
  WebGPUUniformBuffer,
  WebGPUVertexBuffer,
  WebGPUIndexBuffer,
} from "./buffers";

const BLACK: Color = new Color(0, 0, 0, 1);

export type WebGPURendererOptions = {
  autoResize?: boolean;
};

export class WebGPURenderer implements Renderer {
  public readonly __kind: string = "webgpu";
  public readonly camera: Camera2D;

  private readonly logger: Logger;
  private readonly binder: WebGPUBinder;

  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private readonly autoResize: boolean;
  private resizeObserver?: ResizeObserver;
  private logicalWidth: number;
  private logicalHeight: number;

  private bindingGroupCache!: WebGPUBindingGroupCache;
  private shaderCache!: WebGPUShaderCache;
  private pipelineFactory!: WebGPUPipelineFactory;
  private instancePool!: WebGPUInstanceBufferPool;
  private globalBindings!: WebGPUBindingGroup;

  private clock: Clock;

  private currentRenderContext?: WebGPURenderContext;

  constructor(canvas: HTMLCanvasElement, options?: WebGPURendererOptions) {
    this.logger = createLogger("WebGPURenderer");
    this.canvas = canvas;

    this.autoResize = options?.autoResize ?? true;
    this.logicalWidth = canvas.width;
    this.logicalHeight = canvas.height;

    this.clock = new Clock();
    this.camera = new Camera2D();
    this.binder = new WebGPUBinder();
  }

  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.shaderCache.destroy();
    this.bindingGroupCache.destroy();
    this.pipelineFactory.destroy();
    this.instancePool.destroy();
  }

  public getCameraViewport(): Bound {
    const width = this.logicalWidth / this.camera.zoom;
    const height = this.logicalHeight / this.camera.zoom;
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

  public createUniformBuffer(type: UniformType): WebGPUUniformBuffer {
    return new WebGPUUniformBuffer(this.device, type);
  }

  public createSampler(descriptor?: SamplerDescriptor): WebGPUSampler {
    return new WebGPUSampler(this.device, descriptor);
  }

  public createShader(definition: ShaderDescriptor): WebGPUShader {
    return this.shaderCache.getOrCreate(definition);
  }

  public getBuiltinShader(name: string): WebGPUShader {
    const descriptor: ShaderDescriptor | undefined = WebGPUBuiltinShaders[name];

    if (!descriptor) {
      throw new Error(`Unknown built-in shader "${name}".`);
    }

    return this.createShader(descriptor);
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

  public createSpriteBatch(): WebGPUSpriteBatch {
    const shader: WebGPUShader = this.getBuiltinShader("sprite");
    return new WebGPUSpriteBatch(shader);
  }

  public createShapeBatch(): WebGPUShapeBatch {
    const shader: WebGPUShader = this.getBuiltinShader("shape");
    return new WebGPUShapeBatch(shader);
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

  public createRenderTarget({
    width,
    height,
    format,
  }: RenderTargetDescriptor): WebGPUTexture2D {
    return new WebGPUTexture2D(this.device, { width, height, format });
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
    this.pipelineFactory = new WebGPUPipelineFactory(
      this.device,
      this.bindingGroupCache,
    );
    this.instancePool = new WebGPUInstanceBufferPool(this.device);

    if (this.autoResize) {
      this.setupAutoResize();
    }

    this.logger.log("WebGPURenderer initialized successfully.");
  }

  public beginFrame(pass?: PassDescriptor): void {
    const commandEncoder: GPUCommandEncoder =
      this.device.createCommandEncoder();

    const target: WebGPUTexture2D | undefined = pass?.target as
      | WebGPUTexture2D
      | undefined;

    const textureView: GPUTextureView = target
      ? target.view
      : this.context.getCurrentTexture().createView();

    const format: GPUTextureFormat = target ? target.format : this.format;
    const clear: Color = pass?.clear ?? BLACK;

    const renderPass: GPURenderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: clear.r, g: clear.g, b: clear.b, a: clear.a },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    this.currentRenderContext = new WebGPURenderContext({
      commandEncoder,
      renderPass,
      textureView,
      format,
    });

    this.instancePool.reset();
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

    const pipe: WebGPUPipeline = this.pipelineFactory.getIndexed(
      mat.shader,
      geo,
      mat.renderState,
      ctx.format,
    );

    this.bindPipeline(ctx, pipe);
    this.bindGlobalGroup(ctx, pipe);
    this.bindObjectGroup(ctx, binds, pipe);
    this.bindMaterial(ctx, mat, pipe);
    this.bindGeometryAndDrawIndexed(ctx, geo);
  }

  public drawInstancedBatch(batch: InstancedBatch): void {
    const ctx: WebGPURenderContext = this.assertContext();

    if (__DEV__) {
      WebGPUGuard.assertWebGPUInstancedBatch(batch);
    }

    const instanced: WebGPUInstancedBatch = batch as WebGPUInstancedBatch;

    if (instanced.count === 0) {
      return;
    }

    const shader: WebGPUShader = instanced.shader;
    const material: WebGPUBindingGroup | undefined = instanced.materialBindings;
    const hasMaterial: boolean = material !== undefined;

    const pipeline: WebGPUPipeline = this.pipelineFactory.getInstanced(
      shader,
      instanced.renderState,
      ctx.format,
      hasMaterial,
    );

    const globalLayout: GPUBindGroupLayout =
      this.bindingGroupCache.getOrCreateGPULayout(shader.globalDefinition);

    const storageLayout: GPUBindGroupLayout =
      this.pipelineFactory.getStorageLayout(shader);

    const globalCompiled: WebGPUCompiledBindingGroup =
      this.bindingGroupCache.get(this.globalBindings, globalLayout);

    const data: ArrayBuffer = instanced.pack();

    const storageBindGroup: GPUBindGroup = this.instancePool.acquire(
      data,
      instanced.byteSize,
      instanced.storageBinding,
      storageLayout,
    );

    this.assertBindGroup(globalCompiled.bindGroup);

    this.binder.setPipeline(ctx, pipeline.pipeline, shader);
    this.binder.bindGroup(ctx, BINDING_GROUP_GLOBAL, globalCompiled.bindGroup);
    this.binder.bindGroup(ctx, BINDING_GROUP_OBJECT, storageBindGroup);

    if (material) {
      const materialLayout: GPUBindGroupLayout =
        this.bindingGroupCache.getOrCreateGPULayout(shader.materialDefinition);

      const materialCompiled: WebGPUCompiledBindingGroup =
        this.bindingGroupCache.get(material, materialLayout);

      this.assertBindGroup(materialCompiled.bindGroup);
      this.binder.bindGroup(
        ctx,
        BINDING_GROUP_MATERIAL,
        materialCompiled.bindGroup,
      );
    }

    ctx.renderPass.draw(6, instanced.count);
  }

  public endFrame(): void {
    const context: WebGPURenderContext = this.assertContext();
    context.renderPass.end();
    this.device.queue.submit([context.commandEncoder.finish()]);
    this.currentRenderContext = undefined;
  }

  public resize(width: number, height: number): void {
    const dpr: number = this.getDevicePixelRatio();
    this.applyResize(
      width,
      height,
      Math.round(width * dpr),
      Math.round(height * dpr),
    );
  }

  private applyResize(
    logicalWidth: number,
    logicalHeight: number,
    physicalWidth: number,
    physicalHeight: number,
  ): void {
    const width: number = Math.round(physicalWidth);
    const height: number = Math.round(physicalHeight);

    if (width <= 0 || height <= 0) {
      return;
    }

    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  private setupAutoResize(): void {
    this.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) =>
      this.onResizeEntries(entries),
    );
    this.resizeObserver.observe(this.canvas);
  }

  private onResizeEntries(entries: ResizeObserverEntry[]): void {
    const entry: ResizeObserverEntry | undefined = entries[0];

    if (!entry) {
      return;
    }

    const contentBox: ResizeObserverSize = Array.isArray(entry.contentBoxSize)
      ? entry.contentBoxSize[0]
      : (entry.contentBoxSize as unknown as ResizeObserverSize);

    const logicalWidth: number = contentBox.inlineSize;
    const logicalHeight: number = contentBox.blockSize;

    const devicePixelBox: ReadonlyArray<ResizeObserverSize> | undefined =
      entry.devicePixelContentBoxSize;

    if (devicePixelBox && devicePixelBox[0]) {
      this.applyResize(
        logicalWidth,
        logicalHeight,
        devicePixelBox[0].inlineSize,
        devicePixelBox[0].blockSize,
      );
      return;
    }

    const dpr: number = this.getDevicePixelRatio();
    this.applyResize(
      logicalWidth,
      logicalHeight,
      Math.round(logicalWidth * dpr),
      Math.round(logicalHeight * dpr),
    );
  }

  private getDevicePixelRatio(): number {
    return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  }

  private updateCamera(): void {
    const width: number = this.logicalWidth;
    const height: number = this.logicalHeight;
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
