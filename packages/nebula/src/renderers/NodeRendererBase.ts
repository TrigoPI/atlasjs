import { BlendMode, RenderState } from "../core";
import { Node } from "../graphics";

const Z_OFFSET: number = 32768;
const Z_MAX: number = 65535;
const BATCH_RANGE: number = 65536;

export abstract class NodeRendererBase<TNode extends Node, TData> {
  protected static readonly RENDER_STATES: Record<BlendMode, RenderState> = {
    opaque: { blend: "opaque", depthTest: false, cull: "none" },
    alpha: { blend: "alpha", depthTest: false, cull: "none" },
    additive: { blend: "additive", depthTest: false, cull: "none" },
    multiply: { blend: "multiply", depthTest: false, cull: "none" },
  };

  private readonly renderDataCache: WeakMap<TNode, TData>;

  public constructor() {
    this.renderDataCache = new WeakMap();
  }

  protected abstract createRenderData(): TData;

  protected computeSortKey(zIndex: number, batchId: number): number {
    const z: number = Math.min(
      Math.max(Math.round(zIndex) + Z_OFFSET, 0),
      Z_MAX,
    );

    return z * BATCH_RANGE + batchId;
  }

  protected getOrCreateRenderData(node: TNode): TData {
    const cached: TData | undefined = this.renderDataCache.get(node);

    if (cached) {
      return cached;
    }

    const data: TData = this.createRenderData();
    this.renderDataCache.set(node, data);

    return data;
  }
}
