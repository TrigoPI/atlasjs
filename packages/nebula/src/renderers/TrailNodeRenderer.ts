import { Bound, Vec2, Vec4 } from "@atlasjs/math";

import { Color } from "../utils";
import { BlendMode, Renderer } from "../core";
import { Node, TrailNode } from "../graphics";

import { TrailBatcher } from "./Batchers";
import { TrailDrawCommand } from "./DrawCommand";
import { NodeRendererBase } from "./NodeRendererBase";
import { NodeRenderer, Batcher, KIND_ORDER } from "./NodeRenderer";

type TrailRenderData = {
  readonly sourcePositions: Vec2[];
  readonly positions: Vec2[];
  readonly normals: Vec2[];
  readonly edges: Vec2[];
  readonly colors: Vec4[];
};

const MAX_MITER: number = 2;
const EPSILON: number = 1e-6;
const CENTRIPETAL_ALPHA: number = 0.5;
const SPLINE_OVERSHOOT_RATIO: number = 0.125;
const MAX_SMOOTHING: number = 8;

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

  private readonly phantomStart: Vec2;
  private readonly phantomEnd: Vec2;
  private readonly splineA1: Vec2;
  private readonly splineA2: Vec2;
  private readonly splineA3: Vec2;
  private readonly splineB1: Vec2;
  private readonly splineB2: Vec2;

  public constructor() {
    super();
    this.phantomStart = new Vec2();
    this.phantomEnd = new Vec2();
    this.splineA1 = new Vec2();
    this.splineA2 = new Vec2();
    this.splineA3 = new Vec2();
    this.splineB1 = new Vec2();
    this.splineB2 = new Vec2();
  }

  public matches(node: Node): boolean {
    return node instanceof TrailNode;
  }

  public collect(
    node: Node,
    viewport: Bound,
    scratch: Bound,
  ): TrailDrawCommand | null {
    const trail: TrailNode = node as TrailNode;
    const sourceCount: number = trail.pointCount;

    if (sourceCount < 2) {
      return null;
    }

    const data: TrailRenderData = this.getOrCreateRenderData(trail);
    const subdivisions: number = this.resolveSmoothing(trail);
    const count: number = this.computeDensifiedCount(sourceCount, subdivisions);

    this.ensureCapacity(data, sourceCount, count);
    this.readSourcePositions(trail, data, sourceCount);

    if (
      !viewport.overlaps(
        this.computeBound(trail, data, sourceCount, subdivisions, scratch),
      )
    ) {
      return null;
    }

    this.tessellate(data, sourceCount, subdivisions, count);
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
    return {
      sourcePositions: [],
      positions: [],
      normals: [],
      edges: [],
      colors: [],
    };
  }

  private resolveSmoothing(trail: TrailNode): number {
    const raw: number = trail.smoothing;

    if (!Number.isFinite(raw) || raw < 1) {
      return 1;
    }

    return Math.min(Math.floor(raw), MAX_SMOOTHING);
  }

  private computeDensifiedCount(
    sourceCount: number,
    subdivisions: number,
  ): number {
    return subdivisions > 1
      ? (sourceCount - 1) * subdivisions + 1
      : sourceCount;
  }

  private ensureCapacity(
    data: TrailRenderData,
    sourceCount: number,
    count: number,
  ): void {
    while (data.sourcePositions.length < sourceCount) {
      data.sourcePositions.push(new Vec2());
    }

    while (data.positions.length < count) {
      data.positions.push(new Vec2());
      data.normals.push(new Vec2());
      data.edges.push(new Vec2());
      data.colors.push(new Vec4());
    }
  }

  private readSourcePositions(
    trail: TrailNode,
    data: TrailRenderData,
    count: number,
  ): void {
    for (let i: number = 0; i < count; i++) {
      data.sourcePositions[i].set(trail.getPointX(i), trail.getPointY(i));
    }
  }

  private computeBound(
    trail: TrailNode,
    data: TrailRenderData,
    sourceCount: number,
    subdivisions: number,
    out: Bound,
  ): Bound {
    let minX: number = Infinity;
    let minY: number = Infinity;
    let maxX: number = -Infinity;
    let maxY: number = -Infinity;
    let maxChordSq: number = 0;

    for (let i: number = 0; i < sourceCount; i++) {
      const point: Vec2 = data.sourcePositions[i];
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);

      if (i > 0) {
        const previous: Vec2 = data.sourcePositions[i - 1];
        const dx: number = point.x - previous.x;
        const dy: number = point.y - previous.y;
        maxChordSq = Math.max(maxChordSq, dx * dx + dy * dy);
      }
    }

    const margin: number =
      Math.max(trail.startWidth, trail.endWidth) * 0.5 * MAX_MITER +
      (subdivisions > 1 ? Math.sqrt(maxChordSq) * SPLINE_OVERSHOOT_RATIO : 0);

    return out.set(
      minX - margin,
      minY - margin,
      maxX - minX + margin * 2,
      maxY - minY + margin * 2,
    );
  }

  private tessellate(
    data: TrailRenderData,
    sourceCount: number,
    subdivisions: number,
    count: number,
  ): void {
    const last: number = sourceCount - 1;

    if (subdivisions <= 1) {
      for (let i: number = 0; i <= last; i++) {
        data.positions[i].copyFrom(data.sourcePositions[i]);
      }
      return;
    }

    let d1: number = 0;
    let d2: number = 0;
    let d3: number = 0;

    for (let i: number = 0; i < last; i++) {
      const p1: Vec2 = data.sourcePositions[i];
      const p2: Vec2 = data.sourcePositions[i + 1];
      const p0: Vec2 =
        i > 0
          ? data.sourcePositions[i - 1]
          : this.mirror(this.phantomStart, p1, p2);
      const p3: Vec2 =
        i < last - 1
          ? data.sourcePositions[i + 2]
          : this.mirror(this.phantomEnd, p2, p1);

      if (i === 0) {
        d1 = this.centripetalKnot(p0, p1);
        d2 = this.centripetalKnot(p1, p2);
      } else {
        d1 = d2;
        d2 = d3;
      }
      d3 = this.centripetalKnot(p2, p3);

      const base: number = i * subdivisions;

      for (let u: number = 0; u < subdivisions; u++) {
        const f: number = u / subdivisions;
        const outIndex: number = base + u;

        this.evaluateSpline(
          data.positions[outIndex],
          p0,
          p1,
          p2,
          p3,
          d1,
          d2,
          d3,
          f,
        );
      }
    }

    data.positions[count - 1].copyFrom(data.sourcePositions[last]);
  }

  private mirror(out: Vec2, pivot: Vec2, other: Vec2): Vec2 {
    return out.set(pivot.x * 2 - other.x, pivot.y * 2 - other.y);
  }

  private centripetalKnot(a: Vec2, b: Vec2): number {
    const dx: number = b.x - a.x;
    const dy: number = b.y - a.y;
    const distance: number = Math.hypot(dx, dy);

    return Math.max(Math.pow(distance, CENTRIPETAL_ALPHA), EPSILON);
  }

  private evaluateSpline(
    out: Vec2,
    p0: Vec2,
    p1: Vec2,
    p2: Vec2,
    p3: Vec2,
    d1: number,
    d2: number,
    d3: number,
    f: number,
  ): void {
    const t0: number = 0;
    const t1: number = t0 + d1;
    const t2: number = t1 + d2;
    const t3: number = t2 + d3;
    const t: number = t1 + f * d2;

    const a1: Vec2 = this.lerpVec2(this.splineA1, p0, p1, (t - t0) / (t1 - t0));
    const a2: Vec2 = this.lerpVec2(this.splineA2, p1, p2, (t - t1) / (t2 - t1));
    const a3: Vec2 = this.lerpVec2(this.splineA3, p2, p3, (t - t2) / (t3 - t2));
    const b1: Vec2 = this.lerpVec2(this.splineB1, a1, a2, (t - t0) / (t2 - t0));
    const b2: Vec2 = this.lerpVec2(this.splineB2, a2, a3, (t - t1) / (t3 - t1));

    this.lerpVec2(out, b1, b2, (t - t1) / (t2 - t1));
  }

  private lerpVec2(out: Vec2, a: Vec2, b: Vec2, t: number): Vec2 {
    return out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
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
