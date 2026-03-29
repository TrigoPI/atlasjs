import { Mat4 } from "@atlasjs/math";

import {
  Renderer,
  Geometry,
  Pipeline,
  Shader,
  Rect,
  ObjectBinding,
  Material,
} from "../core";

import {
  WebGPUShaders,
  BINDING_LOCATION_MODEL,
  BINDING_LOCATION_COLOR,
} from "../webgpu";

export class ShapeRenderer {
  private readonly renderer: Renderer;

  private geometry!: Geometry;
  private pipeline!: Pipeline;
  private shader!: Shader;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.init();
  }

  public drawRect(rect: Rect): void {
    if (!rect.visible) {
      return;
    }

    const model: Mat4 = Mat4.fromTransform2D(rect.transform);
    const objectBindings: ObjectBinding = this.renderer.createObjectBindings(
      this.pipeline,
    );

    objectBindings.bindMat4At(BINDING_LOCATION_MODEL);
    objectBindings.setMat4At(BINDING_LOCATION_MODEL, model);

    const material: Material = this.renderer.createMaterial(this.pipeline);

    material.bindColor(BINDING_LOCATION_COLOR);
    material.setColor(BINDING_LOCATION_COLOR, rect.color);

    this.renderer.draw(this.geometry, this.pipeline, material, objectBindings);
  }

  private init(): void {
    this.geometry = this.renderer.createQuad();
    this.shader = this.renderer.createShader(WebGPUShaders.Shape);
    this.pipeline = this.renderer.createPipeline(
      this.shader,
      this.geometry.getVertexLayout(),
    );
  }
}
