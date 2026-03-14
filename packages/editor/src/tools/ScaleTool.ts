import { Node, RectNode } from "@atlasjs/nebula";
import { Box2, Mat2, Matrix, Vec2 } from "@atlasjs/math";

import { GizmoContext, GizmoTool } from "../gizmo";

const SIZE: number = 12;
const THICK: number = 3;
const LEN: number = 100;
const SCALE_SPEED: number = 0.01;

export class ScaleTool implements GizmoTool {
  private readonly m: Mat2 = Mat2.identity();
  private readonly base: Mat2 = Mat2.identity();

  private hx!: RectNode;
  private hy!: RectNode;

  private rx!: RectNode;
  private ry!: RectNode;

  private clickPos: Vec2 | null = null;
  private handleSelected: RectNode | null = null;
  private startScale: Box2 | null = null;

  public hit(pWorld: Vec2): boolean {
    return this.rx.hitTestWorld(pWorld) || this.ry.hitTestWorld(pWorld);
  }

  public begin(pWorld: Vec2, { selected }: GizmoContext): void {
    if (!selected) return;
    this.startScale = Box2.create(selected.scale.x, selected.scale.y);
    this.handleClickPosition(pWorld, this.rx);
    this.handleClickPosition(pWorld, this.ry);
  }

  public drag(pWorld: Vec2, { selected }: GizmoContext): void {
    if (!selected) return;
    if (!this.clickPos) return;
    if (!this.handleSelected) return;
    if (!this.startScale) return;

    const scaleDelta: Vec2 = Vec2.sub(pWorld, this.clickPos).mult(SCALE_SPEED);

    if (this.handleSelected == this.rx) {
      selected.scale.x = this.startScale.width + scaleDelta.x;
    }

    if (this.handleSelected == this.ry) {
      selected.scale.y = this.startScale.height + scaleDelta.y;
    }
  }

  public end(): void {
    this.clickPos = null;
    this.handleSelected = null;
    this.startScale = null;
  }

  public mount(ctx: GizmoContext): void {
    this.hx = ctx.renderer.createRect().setFillColor(0xff0000); // red
    this.hy = ctx.renderer.createRect().setFillColor(0x00ff00); // green

    this.rx = ctx.renderer.createRect().setFillColor(0xff0000); // red
    this.ry = ctx.renderer.createRect().setFillColor(0x00ff00); // green

    this.hx.pickable = false;
    this.hy.pickable = false;
  }

  public onUpdate({ selected, camera }: GizmoContext): void {
    if (!selected) return;

    const zoom: number = camera.zoom;
    const len: number = LEN / zoom;
    const thick: number = THICK / zoom;
    const size: number = SIZE / zoom;

    const xLocal: number = len * 0.5;
    const yLocal: number = len * 0.5;

    this.hx.setSize(len, thick);
    this.hy.setSize(thick, len);

    this.rx.setSize(size, size);
    this.ry.setSize(size, size);

    Matrix.withoutScaleTo(selected.worldMatrix, this.base);

    Matrix.translateTo(xLocal, 0, this.m);
    Matrix.multTo(this.base, this.m, this.m);
    this.hx.setWorldMatrix(this.m);

    Matrix.translateTo(0, yLocal, this.m);
    Matrix.multTo(this.base, this.m, this.m);
    this.hy.setWorldMatrix(this.m);

    Matrix.translateTo(len, 0, this.m);
    Matrix.multTo(this.base, this.m, this.m);
    this.rx.setWorldMatrix(this.m);

    Matrix.translateTo(0, len, this.m);
    Matrix.multTo(this.base, this.m, this.m);
    this.ry.setWorldMatrix(this.m);
  }

  public onSelectionChange(node: Node | null, ctx: GizmoContext): void {
    if (!node) return this.clear(ctx);

    // line
    ctx.overlay.add(this.hx);
    ctx.overlay.add(this.hy);

    // rect
    ctx.overlay.add(this.rx);
    ctx.overlay.add(this.ry);
  }

  public unmount(ctx: GizmoContext): void {
    this.clear(ctx);
  }

  private clear(ctx: GizmoContext): void {
    ctx.overlay.remove(this.hx);
    ctx.overlay.remove(this.hy);
    ctx.overlay.remove(this.rx);
    ctx.overlay.remove(this.ry);
  }

  private handleClickPosition(pWorld: Vec2, handle: RectNode): void {
    if (!handle.hitTestWorld(pWorld)) return;
    this.clickPos = pWorld.copy();
    this.handleSelected = handle;
  }
}
