import { Bound, Vec2, Vec4 } from "@atlasjs/math";

import { Color } from "../utils";
import { BlendMode, Renderer } from "../core";
import { Node, TrailNode } from "../graphics";

import { TrailBatcher } from "./Batchers";
import { TrailDrawCommand } from "./DrawCommand";
import { NodeRendererBase } from "./NodeRendererBase";
import { NodeRenderer, Batcher, KIND_ORDER } from "./NodeRenderer";

type TrailRenderData = {
  readonly positions: Vec2[];
  readonly normals: Vec2[];
  readonly edges: Vec2[];
  readonly colors: Vec4[];
};

const MAX_MITER: number = 2;
const EPSILON: number = 1e-6;

const BATCH_IDS: Record<BlendMode, number> = {
  opaque: 0,
  alpha: 1,
  additive: 2,
  multiply: 3,
};

export class TrailNodeRenderer
  extends NodeRendererBase<TrailNode, TrailRenderData>
  implements NodeRenderer
{
  public readonly kind = "trail" as const;

  public matches(node: Node): boolean {
    return node instanceof TrailNode;
  }

  public collect(
    node: Node,
    viewport: Bound,
    scratch: Bound,
  ): TrailDrawCommand | null {
    const trail: TrailNode = node as TrailNode;
    const count: number = trail.pointCount;

    if (count < 2) {
      return null;
    }

    const data: TrailRenderData = this.getOrCreateRenderData(trail);

    this.ensureCapacity(data, count);
    this.readPositions(trail, data, count);

    if (!viewport.overlaps(this.computeBound(trail, data, count, scratch))) {
      return null;
    }

    this.computeNormals(data, count);
    this.computeEdgesAndColors(trail, data, count);

    return {
      kind: "trail",
      sortingLayer: trail.sortingLayer,
      sortPrimary: trail.sortPrimary,
      sortSecondary: trail.sortSecondary,
      kindOrder: KIND_ORDER.trail,
      batchKey: BATCH_IDS[trail.blend],
      renderState: NodeRendererBase.RENDER_STATES[trail.blend],
      positions: data.positions,
      edges: data.edges,
      colors: data.colors,
      pointCount: count,
    };
  }

  public createBatcher(renderer: Renderer): Batcher {
    return new TrailBatcher(renderer.createTrailBatch());
  }

  protected createRenderData(): TrailRenderData {
    return { positions: [], normals: [], edges: [], colors: [] };
  }

  private ensureCapacity(data: TrailRenderData, count: number): void {
    while (data.positions.length < count) {
      data.positions.push(new Vec2());
      data.normals.push(new Vec2());
      data.edges.push(new Vec2());
      data.colors.push(new Vec4());
    }
  }

  private readPositions(
    trail: TrailNode,
    data: TrailRenderData,
    count: number,
  ): void {
    for (let i: number = 0; i < count; i++) {
      data.positions[i].set(trail.getPointX(i), trail.getPointY(i));
    }
  }

  private computeBound(
    trail: TrailNode,
    data: TrailRenderData,
    count: number,
    out: Bound,
  ): Bound {
    let minX: number = Infinity;
    let minY: number = Infinity;
    let maxX: number = -Infinity;
    let maxY: number = -Infinity;

    for (let i: number = 0; i < count; i++) {
      const point: Vec2 = data.positions[i];
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const margin: number =
      Math.max(trail.startWidth, trail.endWidth) * 0.5 * MAX_MITER;

    return out.set(
      minX - margin,
      minY - margin,
      maxX - minX + margin * 2,
      maxY - minY + margin * 2,
    );
  }

  private computeNormals(data: TrailRenderData, count: number): void {
    for (let i: number = 0; i < count - 1; i++) {
      const from: Vec2 = data.positions[i];
      const to: Vec2 = data.positions[i + 1];

      const dx: number = to.x - from.x;
      const dy: number = to.y - from.y;
      const length: number = Math.hypot(dx, dy);

      if (length <= EPSILON) {
        data.normals[i].set(0, 0);
        continue;
      }

      data.normals[i].set(-dy / length, dx / length);
    }
  }

  private computeEdgesAndColors(
    trail: TrailNode,
    data: TrailRenderData,
    count: number,
  ): void {
    const last: number = count - 1;

    for (let i: number = 0; i <= last; i++) {
      const t: number = i / last;
      const width: number =
        trail.startWidth + (trail.endWidth - trail.startWidth) * t;

      this.writeEdge(data, i, last, width * 0.5);
      this.writeColor(trail, data.colors[i], t);
    }
  }

  private writeEdge(
    data: TrailRenderData,
    index: number,
    last: number,
    halfWidth: number,
  ): void {
    const previous: Vec2 = data.normals[Math.max(0, index - 1)];
    const next: Vec2 = data.normals[Math.min(index, last - 1)];

    let mx: number = next.x;
    let my: number = next.y;

    if (index > 0 && index < last) {
      const sx: number = previous.x + next.x;
      const sy: number = previous.y + next.y;
      const length: number = Math.hypot(sx, sy);

      if (length > EPSILON) {
        const nx: number = sx / length;
        const ny: number = sy / length;
        const projection: number = nx * next.x + ny * next.y;
        const scale: number =
          projection > EPSILON
            ? Math.min(1 / projection, MAX_MITER)
            : MAX_MITER;

        mx = nx * scale;
        my = ny * scale;
      }
    }

    data.edges[index].set(mx * halfWidth, my * halfWidth);
  }

  private writeColor(trail: TrailNode, out: Vec4, t: number): void {
    const start: Color = trail.startColor;
    const end: Color = trail.endColor;

    out.set(
      start.r + (end.r - start.r) * t,
      start.g + (end.g - start.g) * t,
      start.b + (end.b - start.b) * t,
      start.a + (end.a - start.a) * t,
    );
  }
}
