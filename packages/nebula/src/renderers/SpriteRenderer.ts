import { Bound, Mat4, Transform2D, Vec2 } from "@atlasjs/math";

import {
  WebGPUShaders,
  BINDING_LOCATION_MODEL,
  BINDING_LOCATION_TEXTURE,
  BINDING_LOCATION_SAMPLER,
  BINDING_LOCATION_SOURCE_RECT,
} from "../webgpu";

import {
  Geometry,
  Material,
  Pipeline,
  Quad,
  Renderer,
  Sampler,
  Shader,
  Sprite,
  Texture2D,
  ObjectBinding,
} from "../core";

export class SpriteRenderer {
  private readonly renderer: Renderer;
  private readonly geometry: Geometry;
  private readonly shader: Shader;
  private readonly pipeline: Pipeline;
  private readonly defaultSampler: Sampler;

  private readonly materialCache: Map<string, Material>;
  private readonly objectBindingsCache: WeakMap<Sprite, ObjectBinding>;
  private readonly modelMatrix: Mat4;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.geometry = renderer.createGeometry(new Quad());
    this.shader = renderer.createShader(WebGPUShaders.Texture2D);
    this.modelMatrix = Mat4.identity();

    this.objectBindingsCache = new WeakMap();
    this.materialCache = new Map();

    this.pipeline = renderer.createPipeline(
      this.shader,
      this.geometry.getVertexLayout(),
    );

    this.defaultSampler = renderer.createSampler({
      minFilter: "linear",
      magFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
  }

  public drawSprite(sprite: Sprite): void {
    if (!sprite.visible) {
      return;
    }

    const material: Material = this.getOrCreateMaterial(
      sprite.texture,
      sprite.sampler ?? this.defaultSampler,
    );

    const objectBindings: ObjectBinding =
      this.getOrCreateObjectBindings(sprite);

    this.updateModelMatrix(sprite);
    objectBindings.setMat4At(BINDING_LOCATION_MODEL, this.modelMatrix);

    const uvRect: Float32Array = this.updateUVRect(sprite);
    objectBindings.setVec4At(BINDING_LOCATION_SOURCE_RECT, uvRect);

    this.renderer.draw(this.geometry, this.pipeline, material, objectBindings);
  }

  public destroy(): void {
    for (const material of this.materialCache.values()) {
      material.destroy();
    }

    this.materialCache.clear();
  }

  private createMaterialKey(texture: Texture2D, sampler: Sampler): string {
    return `${texture.id}|${sampler.id}`;
  }

  private getOrCreateMaterial(texture: Texture2D, sampler: Sampler): Material {
    const key: string = this.createMaterialKey(texture, sampler);
    const cached: Material | undefined = this.materialCache.get(key);

    if (cached) {
      return cached;
    }

    const material: Material = this.renderer.createMaterial(this.pipeline);

    material.bindTexture2D(BINDING_LOCATION_TEXTURE, texture);
    material.bindSampler(BINDING_LOCATION_SAMPLER, sampler);

    this.materialCache.set(key, material);

    return material;
  }

  private getOrCreateObjectBindings(sprite: Sprite): ObjectBinding {
    const cached: ObjectBinding | undefined =
      this.objectBindingsCache.get(sprite);

    if (cached) {
      return cached;
    }

    const objectBindings: ObjectBinding = this.renderer.createObjectBindings(
      this.pipeline,
    );

    objectBindings.bindMat4At(BINDING_LOCATION_MODEL);
    objectBindings.bindVec4At(BINDING_LOCATION_SOURCE_RECT);

    this.objectBindingsCache.set(sprite, objectBindings);

    return objectBindings;
  }

  private updateModelMatrix(sprite: Sprite): void {
    const t: Transform2D = sprite.transform;
    const anchor: Vec2 = sprite.getAnchor();

    const anchorOffsetX: number = (0.5 - anchor.x) * t.scale.x;
    const anchorOffsetY: number = (0.5 - anchor.y) * t.scale.y;

    this.modelMatrix
      .fromTransform2D(t)
      .translate(anchorOffsetX, anchorOffsetY, 0);
  }

  private updateUVRect(sprite: Sprite): Float32Array {
    const texture: Texture2D = sprite.texture;
    const rect: Bound = sprite.getSourceRect();

    const u0: number = rect.x / texture.width;
    const v0: number = rect.y / texture.height;
    const du: number = rect.width / texture.width;
    const dv: number = rect.height / texture.height;

    return new Float32Array([u0, v0, du, dv]);
  }
}
