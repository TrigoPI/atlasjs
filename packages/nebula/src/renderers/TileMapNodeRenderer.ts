import { Bound, Mat4, Vec4 } from "@atlasjs/math";
import { Node, TileInstance, TileMapNode } from "../graphics";
import { TileMapDrawCommand } from "./DrawCommand";
import { NodeRendererBase } from "./NodeRendererBase";
import { NodeRenderer, Batcher, KIND_ORDER } from "./NodeRenderer";
import { TileMapBatcher } from "./Batchers";
import { Renderer, Sampler } from "../core";

type TileMapRenderData = {
  models: Mat4[];
  uvRects: Vec4[];
};

export class TileMapNodeRenderer
  extends NodeRendererBase<TileMapNode, TileMapRenderData>
  implements NodeRenderer
{
  public readonly kind = "tilemap" as const;

  private readonly defaultSampler: Sampler;
  private readonly batchIds: Map<string, number>;

  private nextBatchId: number;

  public constructor(renderer: Renderer) {
    super();

    this.batchIds = new Map();
    this.nextBatchId = 0;

    this.defaultSampler = renderer.createSampler({
      minFilter: "nearest",
      magFilter: "nearest",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
  }

  public matches(node: Node): boolean {
    return node instanceof TileMapNode;
  }

  public collect(
    node: Node,
    _viewport: Bound,
    _scratch: Bound,
  ): TileMapDrawCommand | null {
    const tilemap: TileMapNode = node as TileMapNode;

    if (tilemap.texture === null || tilemap.instances.length === 0) {
      return null;
    }

    const sampler: Sampler = tilemap.sampler ?? this.defaultSampler;
    const materialKey: string = `${tilemap.texture.id}|${sampler.id}|${tilemap.blend}`;
    const batchId: number = this.getBatchId(materialKey);

    const data: TileMapRenderData = this.getOrCreateRenderData(tilemap);
    this.updateInstances(tilemap, data);

    return {
      kind: "tilemap",
      sortingLayer: tilemap.sortingLayer,
      sortPrimary: tilemap.sortPrimary,
      sortSecondary: tilemap.sortSecondary,
      kindOrder: KIND_ORDER.tilemap,
      batchKey: batchId,
      renderState: NodeRendererBase.RENDER_STATES[tilemap.blend],
      texture: tilemap.texture,
      sampler,
      tint: tilemap.tint,
      models: data.models,
      uvRects: data.uvRects,
      count: tilemap.instances.length,
    };
  }

  public createBatcher(renderer: Renderer): Batcher {
    return new TileMapBatcher(renderer.createSpriteBatch());
  }

  protected createRenderData(): TileMapRenderData {
    return { models: [], uvRects: [] };
  }

  private updateInstances(node: TileMapNode, data: TileMapRenderData): void {
    const worldMatrix: Mat4 = node.worldMatrix;
    const instances: TileInstance[] = node.instances;

    for (let i: number = 0; i < instances.length; i++) {
      const instance: TileInstance = instances[i];

      let model: Mat4 | undefined = data.models[i];
      if (model === undefined) {
        model = Mat4.identity();
        data.models[i] = model;
      }

      const centerX: number = instance.x + instance.width * 0.5;
      const centerY: number = instance.y + instance.height * 0.5;

      model
        .copy(worldMatrix)
        .translate(centerX, centerY, 0)
        .scale(instance.width, instance.height);

      data.uvRects[i] = instance.uvRect;
    }

    data.models.length = instances.length;
    data.uvRects.length = instances.length;
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
}
