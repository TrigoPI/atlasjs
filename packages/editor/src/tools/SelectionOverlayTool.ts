import { Bound, Mat2, Matrix } from "@atlasjs/math";
import { createLogger, Logger } from "@atlasjs/utils";
import { RectNode, Node, NebulaRenderer } from "@atlasjs/nebula";

import { GizmoContext, GizmoTool } from "../gizmo";

const STROKE_WIDTH: number = 4;
const STROKE_COLOR: number = 0x00ffcc;
const STROKE_ALPHA: number = 1;

export class SelectionOverlayTool implements GizmoTool {
  private logger: Logger;

  private outline: RectNode | null;
  private selected: Node | null;

  private readonly m: Mat2;

  public constructor() {
    this.logger = createLogger(SelectionOverlayTool.name);
    this.logger.log("Creating selection overlay tool...");

    this.outline = null;
    this.selected = null;

    this.m = Mat2.identity();
  }

  public onUpdate(ctx: GizmoContext): void {
    if (!this.outline || !this.selected) return;

    const bound: Bound = this.selected.getLocalBound();
    if (bound.isZero()) return this.clear(ctx.renderer);

    const cx: number = bound.x + bound.width * 0.5;
    const cy: number = bound.y + bound.height * 0.5;

    const zoom: number = ctx.camera.zoom;
    const wm: Mat2 = this.selected.worldMatrix;

    const a: number = wm.a;
    const b: number = wm.b;
    const c: number = wm.c;
    const d: number = wm.d;

    const sx: number = Math.hypot(a, b);
    const sy: number = Math.hypot(c, d);

    const avgScale: number = (sx + sy) * 0.5;
    const safeScale: number = avgScale > 1e-8 ? avgScale : 1;
    const safeZoom: number = zoom > 1e-8 ? zoom : 1;
    const strokeWidth: number = STROKE_WIDTH / (safeScale * safeZoom);

    this.outline.setSize(bound.width, bound.height);

    Matrix.translateTo(cx, cy, this.m);
    Matrix.multTo(wm, this.m, this.m);
    this.outline.setWorldMatrix(this.m).setStrokeWidth(strokeWidth);
  }

  public onSelectionChange(node: Node | null, ctx: GizmoContext): void {
    if (!node) {
      return this.clear(ctx.renderer);
    }

    if (!this.outline) {
      this.logger.log(`Creating selection outline for ${node.id}`);
      this.outline = ctx.renderer
        .createRect()
        .setAlpha(0)
        .setStrokeWidth(STROKE_WIDTH)
        .setStrokeColor(STROKE_COLOR)
        .setStrokeAlpha(STROKE_ALPHA);

      this.outline.pickable = false;
      ctx.overlay.add(this.outline);
    }

    this.selected = node;
  }

  public unmount(ctx: GizmoContext): void {
    this.logger.log("Destroying selection overlay tool...");
    this.clear(ctx.renderer);
  }

  private clear(renderer: NebulaRenderer): void {
    if (this.outline) renderer.overlay.remove(this.outline);
    this.selected = null;
    this.outline = null;
  }
}
