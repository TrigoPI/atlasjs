import { Bound } from "@atlasjs/math";

import { SceneGraph } from "./scene";
import { SceneRenderer } from "./renderers";

import {
  Camera2D,
  Material,
  PassDescriptor,
  Renderer,
  RenderState,
  Sampler,
  SamplerDescriptor,
  Shader,
  ShaderDescriptor,
  Texture2D,
  Texture2DDescriptor,
} from "./core";

export class NebulaRenderer {
  public scene!: SceneGraph;

  private renderer!: Renderer;
  private sceneRenderer!: SceneRenderer;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  public get camera(): Camera2D {
    return this.renderer.camera as Camera2D;
  }

  public getCameraViewport(): Bound {
    return this.renderer.getCameraViewport();
  }

  public resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }

  public createMaterial(shader: Shader, renderState?: RenderState): Material {
    return this.renderer.createMaterial(shader, renderState);
  }

  public createShader(definition: ShaderDescriptor): Shader {
    return this.renderer.createShader(definition);
  }

  public createSampler(descriptor: SamplerDescriptor): Sampler {
    return this.renderer.createSampler(descriptor);
  }

  public createTexture2D(descriptor: Texture2DDescriptor): Texture2D {
    return this.renderer.createTexture2D(descriptor);
  }

  public async init(): Promise<void> {
    await this.renderer.init();
    this.scene = new SceneGraph();
    this.sceneRenderer = new SceneRenderer(this.renderer);
  }

  public render(pass?: PassDescriptor): void {
    this.sceneRenderer.render(this.scene, pass);
  }
}
