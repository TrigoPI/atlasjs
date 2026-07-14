import { Bound, Mat4, Vec2, Vec4 } from "@atlasjs/math";
import { Sprite } from "../graphics";
import { DrawCommand } from "./DrawCommand";

import {
  Renderer,
  Geometry,
  Shader,
  Sampler,
  Texture2D,
  Material,
  Quad,
  BindingGroup,
} from "../core";

type SpriteRenderData = {
  readonly bindings: BindingGroup;
  readonly model: Mat4;
  readonly sourceRect: Vec4;
};

const Z_OFFSET: number = 32768;
const Z_MAX: number = 65535;
const BATCH_RANGE: number = 65536;
const BATCH_MAX: number = 65535;

export class SpriteRenderer {
  private readonly renderer: Renderer;
  private readonly geometry: Geometry;
  private readonly shader: Shader;
  private readonly defaultSampler: Sampler;
  private readonly materialCache: Map<string, Material>;
  private readonly renderDataCache: WeakMap<Sprite, SpriteRenderData>;
  private readonly batchIds: Map<string, number>;
  private readonly sourceRectScratch: Bound;

  private nextBatchId: number;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.shader = this.initShader();
    this.geometry = renderer.createGeometry(new Quad());

    this.materialCache = new Map();
    this.renderDataCache = new WeakMap();
    this.batchIds = new Map();
    this.sourceRectScratch = new Bound();
    this.nextBatchId = 0;

    this.defaultSampler = renderer.createSampler({
      minFilter: "linear",
      magFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
  }

  public buildCommand(sprite: Sprite): DrawCommand {
    const sampler: Sampler = sprite.sampler ?? this.defaultSampler;
    const materialKey: string = this.createMaterialKey(sprite.texture, sampler);
    const material: Material = this.getOrCreateMaterial(
      materialKey,
      sprite.texture,
      sampler,
    );

    const data: SpriteRenderData = this.getOrCreateRenderData(sprite);
    const sourceRect: Bound = sprite.getSourceRect(this.sourceRectScratch);

    this.updateSourceRect(sprite.texture, sourceRect, data.sourceRect);
    this.updateModelMatrix(sprite, sourceRect, data.model);

    data.bindings.set("model", data.model).set("sourceRect", data.sourceRect);

    return {
      sortKey: this.computeSortKey(sprite, materialKey),
      geometry: this.geometry,
      material,
      bindings: data.bindings,
    };
  }

  private getOrCreateMaterial(
    key: string,
    texture: Texture2D,
    sampler: Sampler,
  ): Material {
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

  private getOrCreateRenderData(sprite: Sprite): SpriteRenderData {
    const cached: SpriteRenderData | undefined =
      this.renderDataCache.get(sprite);

    if (cached) {
      return cached;
    }

    const data: SpriteRenderData = {
      bindings: this.renderer.createBindingGroup(this.shader.objectDefinition),
      model: Mat4.identity(),
      sourceRect: new Vec4(0, 0, 1, 1),
    };

    this.renderDataCache.set(sprite, data);

    return data;
  }

  private computeSortKey(sprite: Sprite, materialKey: string): number {
    const z: number = Math.min(
      Math.max(Math.round(sprite.zIndex) + Z_OFFSET, 0),
      Z_MAX,
    );

    return z * BATCH_RANGE + this.getBatchId(materialKey);
  }

  private getBatchId(key: string): number {
    let id: number | undefined = this.batchIds.get(key);

    if (id === undefined) {
      id = Math.min(this.nextBatchId, BATCH_MAX);
      this.nextBatchId++;
      this.batchIds.set(key, id);
    }

    return id;
  }

  private updateSourceRect(texture: Texture2D, rect: Bound, out: Vec4): void {
    const u0: number = rect.x / texture.width;
    const v0: number = rect.y / texture.height;
    const du: number = rect.width / texture.width;
    const dv: number = rect.height / texture.height;

    out.set(u0, v0, du, dv);
  }

  private createMaterialKey(texture: Texture2D, sampler: Sampler): string {
    return `${texture.id}|${sampler.id}`;
  }

  private initShader(): Shader {
    // The backend provides the sprite shader; its bindings are reflected from
    // the source — SpriteRenderer stays free of any shading language.
    return this.renderer.createSpriteShader();
  }

  private updateModelMatrix(sprite: Sprite, sourceRect: Bound, out: Mat4): void {
    const worldMatrix: Mat4 = sprite.worldMatrix;

    const anchor: Vec2 = sprite.getAnchor();
    const width: number = sourceRect.width;
    const height: number = sourceRect.height;

    const anchorOffsetX: number = (0.5 - anchor.x) * width;
    const anchorOffsetY: number = (0.5 - anchor.y) * height;

    out
      .copy(worldMatrix)
      .translate(anchorOffsetX, anchorOffsetY, 0)
      .scale(width, height);
  }
}
