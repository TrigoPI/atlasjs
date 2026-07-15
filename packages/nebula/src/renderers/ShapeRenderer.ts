import { Bound, Mat4, Vec2, Vec4 } from "@atlasjs/math";

import { BlendMode, Renderer } from "../core";
import { Node, Shape, Rect, Circle, Line } from "../graphics";
import { ShapeDrawCommand } from "./DrawCommand";
import { NodeRendererBase } from "./NodeRendererBase";
import { NodeRenderer, Batcher, KIND_ORDER } from "./NodeRenderer";
import { ShapeBatcher } from "./Batchers";
import { computeModelWorldBound } from "./worldBound";

type ShapeRenderData = {
  readonly model: Mat4;
  readonly color: Vec4;
  readonly params: Vec4;
};

const SHAPE_KIND_FILL: number = 0;
const SHAPE_KIND_CIRCLE: number = 1;

const BATCH_IDS: Record<BlendMode, number> = {
  opaque: 0,
  alpha: 1,
  additive: 2,
  multiply: 3,
};

export class ShapeRenderer
  extends NodeRendererBase<Shape, ShapeRenderData>
  implements NodeRenderer
{
  public readonly kind = "shape" as const;

  private readonly lineMatrixScratch: Mat4;

  public constructor() {
    super();

    this.lineMatrixScratch = Mat4.identity();
  }

  public matches(node: Node): boolean {
    return node instanceof Shape;
  }

  public collect(
    node: Node,
    viewport: Bound,
    scratch: Bound,
  ): ShapeDrawCommand | null {
    const command: ShapeDrawCommand | null = this.buildCommand(node);

    if (!command) {
      return null;
    }

    const bound: Bound = computeModelWorldBound(command.model, scratch);

    return viewport.overlaps(bound) ? command : null;
  }

  private buildCommand(node: Node): ShapeDrawCommand | null {
    const shape: Shape = node as Shape;

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
      batchKey: BATCH_IDS[shape.blend],
      renderState: NodeRendererBase.RENDER_STATES[shape.blend],
      model: data.model,
      color: data.color,
      params: data.params,
      sortKey: this.computeSortKey(
        shape.zIndex,
        KIND_ORDER.shape,
        BATCH_IDS[shape.blend],
      ),
    };
  }

  public createBatcher(renderer: Renderer): Batcher {
    return new ShapeBatcher(renderer.createShapeBatch());
  }

  protected createRenderData(): ShapeRenderData {
    return {
      model: Mat4.identity(),
      color: new Vec4(1, 1, 1, 1),
      params: new Vec4(0, 0, 0, 0),
    };
  }

  private shapeKindOf(shape: Shape): number {
    if (shape instanceof Circle) return SHAPE_KIND_CIRCLE;
    if (shape instanceof Rect) return SHAPE_KIND_FILL;
    if (shape instanceof Line) return SHAPE_KIND_FILL;
    return -1;
  }

  private updateColor(shape: Shape, out: Vec4): void {
    out.set(shape.color.r, shape.color.g, shape.color.b, shape.color.a);
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
