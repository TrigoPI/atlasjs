import { Bound, Mat4, Vec2, Vec4 } from "@atlasjs/math";
import { Sprite } from "../graphics";
import { WebGPUShaders } from "../webgpu";

import {
  Renderer,
  Geometry,
  Shader,
  Pipeline,
  Sampler,
  Texture2D,
  Material,
  Quad,
  BindingGroup,
} from "../core";

export class SpriteRenderer {
  private readonly renderer: Renderer;
  private readonly geometry: Geometry;
  private readonly shader: Shader;
  private readonly pipeline: Pipeline;
  private readonly defaultSampler: Sampler;
  private readonly materialCache: Map<string, Material>;
  private readonly objectBindingGroupCache: WeakMap<Sprite, BindingGroup>;

  private readonly modelMatrix: Mat4;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.modelMatrix = Mat4.identity();
    this.shader = this.initShader();

    this.geometry = renderer.createGeometry(new Quad());
    this.pipeline = renderer.createPipeline(this.shader, this.geometry);

    this.materialCache = new Map();
    this.objectBindingGroupCache = new WeakMap();

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

    const sourceRect: Vec4 = this.updateUVRect(sprite);
    const bindingGroup: BindingGroup =
      this.getOrCreateObjectBindingGroup(sprite);

    this.updateModelMatrix(sprite);

    bindingGroup.set("model", this.modelMatrix).set("sourceRect", sourceRect);

    this.renderer.draw(this.geometry, this.pipeline, material, bindingGroup);
  }

  private getOrCreateMaterial(texture: Texture2D, sampler: Sampler): Material {
    const key: string = this.createMaterialKey(texture, sampler);
    const cached: Material | undefined = this.materialCache.get(key);

    if (cached) {
      return cached;
    }

    const material: Material = this.renderer
      .createMaterial(this.shader)
      .set("uTexture", texture)
      .set("uSampler", sampler);

    this.materialCache.set(key, material);

    return material;
  }

  private getOrCreateObjectBindingGroup(sprite: Sprite): BindingGroup {
    const cached: BindingGroup | undefined =
      this.objectBindingGroupCache.get(sprite);

    if (cached) {
      return cached;
    }

    const bindingGroup: BindingGroup = this.renderer.createBindingGroup(
      this.shader.objectDefinition,
    );

    this.objectBindingGroupCache.set(sprite, bindingGroup);

    return bindingGroup;
  }

  private updateUVRect(sprite: Sprite): Vec4 {
    const texture: Texture2D = sprite.texture;
    const rect: Bound = sprite.getSourceRect();

    const u0: number = rect.x / texture.width;
    const v0: number = rect.y / texture.height;
    const du: number = rect.width / texture.width;
    const dv: number = rect.height / texture.height;

    return new Vec4(u0, v0, du, dv);
  }

  private createMaterialKey(texture: Texture2D, sampler: Sampler): string {
    return `${texture.id}|${sampler.id}`;
  }

  private initShader(): Shader {
    return this.renderer.createShader(WebGPUShaders.Texture2D);
  }

  private updateModelMatrix(sprite: Sprite): void {
    const worldMatrix: Mat4 = sprite.worldMatrix;

    const anchor: Vec2 = sprite.getAnchor();
    const sourceRect: Bound = sprite.getSourceRect();
    const width: number = sourceRect.width;
    const height: number = sourceRect.height;

    const anchorOffsetX: number = (0.5 - anchor.x) * width;
    const anchorOffsetY: number = (0.5 - anchor.y) * height;

    this.modelMatrix
      .copy(worldMatrix)
      .translate(anchorOffsetX, anchorOffsetY, 0)
      .scale(width, height);
  }
}
