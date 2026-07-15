import { Bound, Mat4, Vec2, Vec4 } from "@atlasjs/math";
import { Node, Sprite } from "../graphics";
import { SpriteDrawCommand } from "./DrawCommand";
import { NodeRendererBase } from "./NodeRendererBase";
import { NodeRenderer, Batcher, KIND_ORDER } from "./NodeRenderer";
import { SpriteBatcher } from "./Batchers";

import { BlendMode, Renderer, Sampler, Texture2D } from "../core";

type SpriteRenderData = {
  readonly model: Mat4;
  readonly uvRect: Vec4;
};

export class SpriteRenderer
  extends NodeRendererBase<Sprite, SpriteRenderData>
  implements NodeRenderer
{
  public readonly kind = "sprite" as const;

  private readonly defaultSampler: Sampler;
  private readonly batchIds: Map<string, number>;
  private readonly sourceRectScratch: Bound;

  private nextBatchId: number;

  public constructor(renderer: Renderer) {
    super();

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

  public matches(node: Node): boolean {
    return node instanceof Sprite;
  }

  public collect(
    node: Node,
    viewport: Bound,
    scratch: Bound,
  ): SpriteDrawCommand | null {
    const sprite: Sprite = node as Sprite;
    const bound: Bound = sprite.getWorldBound(scratch);

    if (!viewport.overlaps(bound)) {
      return null;
    }

    return this.buildCommand(node);
  }

  private buildCommand(node: Node): SpriteDrawCommand {
    const sprite: Sprite = node as Sprite;

    const sampler: Sampler = sprite.sampler ?? this.defaultSampler;
    const materialKey: string = this.createMaterialKey(
      sprite.texture,
      sampler,
      sprite.blend,
    );

    const batchId: number = this.getBatchId(materialKey);

    const data: SpriteRenderData = this.getOrCreateRenderData(sprite);
    const sourceRect: Bound = sprite.getSourceRect(this.sourceRectScratch);

    this.updateUVRect(sprite.texture, sourceRect, data.uvRect);
    this.updateModelMatrix(sprite, sourceRect, data.model);

    return {
      kind: "sprite",
      sortKey: this.computeSortKey(sprite.zIndex, KIND_ORDER.sprite, batchId),
      batchKey: batchId,
      texture: sprite.texture,
      sampler,
      renderState: NodeRendererBase.RENDER_STATES[sprite.blend],
      model: data.model,
      uvRect: data.uvRect,
      tint: sprite.tint,
    };
  }

  public createBatcher(renderer: Renderer): Batcher {
    return new SpriteBatcher(renderer.createSpriteBatch());
  }

  protected createRenderData(): SpriteRenderData {
    return { model: Mat4.identity(), uvRect: new Vec4(0, 0, 1, 1) };
  }

  private getBatchId(key: string): number {
    const BATCH_MAX: number = 65535;
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

  private updateModelMatrix(
    sprite: Sprite,
    sourceRect: Bound,
    out: Mat4,
  ): void {
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
