import { Box2 } from "@atlasjs/math";

import { SceneGraph } from "./scene";
import { SceneRenderer } from "./renderers";

import {
  Camera2D,
  Material,
  Renderer,
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
    return this.renderer.camera;
  }

  public getViewport(): Box2 {
    return this.renderer.getViewport();
  }

  public createMaterial(shader: Shader): Material {
    return this.renderer.createMaterial(shader);
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

  public render(): void {
    this.sceneRenderer.render(this.scene);
  }
}
