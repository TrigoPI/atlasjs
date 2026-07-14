import { Bound, Mat4, Vec2, Vec4 } from "@atlasjs/math";

import { BlendMode, RenderState } from "../core";
import { Shape, Rect, Circle, Line } from "../graphics";
import { ShapeDrawCommand } from "./DrawCommand";

type ShapeRenderData = {
  readonly model: Mat4;
  readonly color: Vec4;
  readonly params: Vec4;
};

const SHAPE_KIND_FILL: number = 0;
const SHAPE_KIND_CIRCLE: number = 1;

const Z_OFFSET: number = 32768;
const Z_MAX: number = 65535;
const BATCH_RANGE: number = 65536;

const RENDER_STATES: Record<BlendMode, RenderState> = {
  opaque: { blend: "opaque", depthTest: false, cull: "none" },
  alpha: { blend: "alpha", depthTest: false, cull: "none" },
  additive: { blend: "additive", depthTest: false, cull: "none" },
  multiply: { blend: "multiply", depthTest: false, cull: "none" },
};

const BATCH_IDS: Record<BlendMode, number> = {
  opaque: 0,
  alpha: 1,
  additive: 2,
  multiply: 3,
};

export class ShapeRenderer {
  private readonly renderDataCache: WeakMap<Shape, ShapeRenderData>;
  private readonly lineMatrixScratch: Mat4;

  public constructor() {
    this.renderDataCache = new WeakMap();
    this.lineMatrixScratch = Mat4.identity();
  }

  public buildCommand(shape: Shape): ShapeDrawCommand | null {
    const kind: number = this.shapeKindOf(shape);

    if (kind === -1) {
      return null;
    }

    const data: ShapeRenderData = this.getOrCreateRenderData(shape);

    this.updateColor(shape, data.color);
    data.params.set(kind, 0, 0, 0);
    this.updateModelMatrix(shape, data.model);

    return {
      kind: "shape",
      sortKey: this.computeSortKey(shape),
      batchKey: BATCH_IDS[shape.blend],
      renderState: RENDER_STATES[shape.blend],
      model: data.model,
      color: data.color,
      params: data.params,
    };
  }

  public getWorldBound(command: ShapeDrawCommand, out: Bound): Bound {
    const m: Float32Array = command.model.buffer;
    const m0: number = m[0];
    const m1: number = m[1];
    const m4: number = m[4];
    const m5: number = m[5];
    const m12: number = m[12];
    const m13: number = m[13];

    const corners: number[] = [-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5];

    let minX: number = Infinity;
    let minY: number = Infinity;
    let maxX: number = -Infinity;
    let maxY: number = -Infinity;

    for (let i: number = 0; i < corners.length; i += 2) {
      const cx: number = corners[i];
      const cy: number = corners[i + 1];
      const px: number = m0 * cx + m4 * cy + m12;
      const py: number = m1 * cx + m5 * cy + m13;

      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }

    return out.set(minX, minY, maxX - minX, maxY - minY);
  }

  private shapeKindOf(shape: Shape): number {
    if (shape instanceof Circle) return SHAPE_KIND_CIRCLE;
    if (shape instanceof Rect) return SHAPE_KIND_FILL;
    if (shape instanceof Line) return SHAPE_KIND_FILL;
    return -1;
  }

  private getOrCreateRenderData(shape: Shape): ShapeRenderData {
    const cached: ShapeRenderData | undefined =
      this.renderDataCache.get(shape);

    if (cached) {
      return cached;
    }

    const data: ShapeRenderData = {
      model: Mat4.identity(),
      color: new Vec4(1, 1, 1, 1),
      params: new Vec4(0, 0, 0, 0),
    };

    this.renderDataCache.set(shape, data);

    return data;
  }

  private updateColor(shape: Shape, out: Vec4): void {
    out.set(shape.color.r, shape.color.g, shape.color.b, shape.color.a);
  }

  private computeSortKey(shape: Shape): number {
    const z: number = Math.min(
      Math.max(Math.round(shape.zIndex) + Z_OFFSET, 0),
      Z_MAX,
    );

    return z * BATCH_RANGE + BATCH_IDS[shape.blend];
  }

  private updateModelMatrix(shape: Shape, out: Mat4): void {
    if (shape instanceof Line) {
      this.updateLineMatrix(shape, out);
      return;
    }

    out.copy(shape.worldMatrix);
  }

  private updateLineMatrix(line: Line, out: Mat4): void {
    const start: Vec2 = line.start;
    const end: Vec2 = line.end;

    const dx: number = end.x - start.x;
    const dy: number = end.y - start.y;
    const length: number = Math.hypot(dx, dy);
    const angle: number = Math.atan2(dy, dx);
    const midX: number = (start.x + end.x) * 0.5;
    const midY: number = (start.y + end.y) * 0.5;

    this.lineMatrixScratch
      .identity()
      .translate(midX, midY, 0)
      .rotateZ(angle)
      .scale(length, line.thickness);

    out.copy(line.worldMatrix).multiply(this.lineMatrixScratch);
  }
}
