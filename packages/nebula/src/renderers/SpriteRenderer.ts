import { Bound, Mat4, Vec2, Vec4 } from "@atlasjs/math";
import { Sprite } from "../graphics";
import { DrawCommand } from "./DrawCommand";

import { BlendMode, Renderer, RenderState, Sampler, Texture2D } from "../core";

type SpriteRenderData = {
  readonly model: Mat4;
  readonly uvRect: Vec4;
};

const RENDER_STATES: Record<BlendMode, RenderState> = {
  opaque: { blend: "opaque", depthTest: false, cull: "none" },
  alpha: { blend: "alpha", depthTest: false, cull: "none" },
  additive: { blend: "additive", depthTest: false, cull: "none" },
  multiply: { blend: "multiply", depthTest: false, cull: "none" },
};

const Z_OFFSET: number = 32768;
const Z_MAX: number = 65535;
const BATCH_RANGE: number = 65536;
const BATCH_MAX: number = 65535;

export class SpriteRenderer {
  private readonly defaultSampler: Sampler;
  private readonly renderDataCache: WeakMap<Sprite, SpriteRenderData>;
  private readonly batchIds: Map<string, number>;
  private readonly sourceRectScratch: Bound;

  private nextBatchId: number;

  public constructor(renderer: Renderer) {
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
    const materialKey: string = this.createMaterialKey(
      sprite.texture,
      sampler,
      sprite.blend,
    );

    const data: SpriteRenderData = this.getOrCreateRenderData(sprite);
    const sourceRect: Bound = sprite.getSourceRect(this.sourceRectScratch);

    this.updateUVRect(sprite.texture, sourceRect, data.uvRect);
    this.updateModelMatrix(sprite, sourceRect, data.model);

    return {
      sortKey: this.computeSortKey(sprite, materialKey),
      batchKey: this.getBatchId(materialKey),
      texture: sprite.texture,
      sampler,
      renderState: RENDER_STATES[sprite.blend],
      model: data.model,
      uvRect: data.uvRect,
      tint: sprite.tint,
    };
  }

  private getOrCreateRenderData(sprite: Sprite): SpriteRenderData {
    const cached: SpriteRenderData | undefined =
      this.renderDataCache.get(sprite);

    if (cached) {
      return cached;
    }

    const data: SpriteRenderData = {
      model: Mat4.identity(),
      uvRect: new Vec4(0, 0, 1, 1),
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

  private updateUVRect(texture: Texture2D, rect: Bound, out: Vec4): void {
    const u0: number = rect.x / texture.width;
    const v0: number = rect.y / texture.height;
    const du: number = rect.width / texture.width;
    const dv: number = rect.height / texture.height;

    out.set(u0, v0, du, dv);
  }

  private createMaterialKey(
    texture: Texture2D,
    sampler: Sampler,
    blend: BlendMode,
  ): string {
    return `${texture.id}|${sampler.id}|${blend}`;
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
