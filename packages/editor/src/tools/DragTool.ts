import { Node, RectNode } from "@atlasjs/nebula";
import { Mat2, Matrix } from "@atlasjs/math";
import { createLogger, Logger } from "@atlasjs/utils";

import { GizmoContext, GizmoTool } from "../gizmo";

const SIZE: number = 12;

export class DragTool implements GizmoTool {
  private readonly logger: Logger;
  private readonly m: Mat2 = Mat2.identity();
  private readonly base: Mat2 = Mat2.identity();

  private np!: RectNode;
  private selected: Node | null = null;

  public constructor() {
    this.logger = createLogger(DragTool.name);
    this.logger.log("Creating drag tool...");
  }

  public mount(ctx: GizmoContext): void {
    this.np = ctx.renderer.createRect().setFillColor(0xff00ff);
  }

  public onUpdate(ctx: GizmoContext): void {
    if (!this.selected) return;
    const zoom: number = ctx.camera.zoom;
    const size: number = SIZE / zoom;

    this.np.setSize(size, size);

    Matrix.withoutScaleTo(this.selected.worldMatrix, this.base);
    Matrix.translateTo(0, 0, this.m);
    Matrix.multTo(this.base, this.m, this.m);
    this.np.setWorldMatrix(this.m);
  }

  public onSelectionChange(node: Node | null, ctx: GizmoContext): void {
    if (!node) return this.clear(ctx);
    ctx.overlay.add(this.np);
    this.selected = node;
  }

  public unmount(ctx: GizmoContext): void {
    this.clear(ctx);
  }

  private clear(ctx: GizmoContext): void {
    ctx.overlay.remove(this.np);
  }
}
