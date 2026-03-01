import { Input } from "@atlasjs/input";
import { Vec2, Mat2, cos, sin } from "@atlasjs/math";
import { createLogger, Logger } from "@atlasjs/utils";
import { Camera2D, NebulaRenderer, Node, RectNode } from "@atlasjs/nebula";

import { SelectionSystem } from "../selection";
import { GizmoContext, GizmoHandle, GizmoHandleKind } from "./types";
import { GizmoTool } from "./GizmoTool";

export class Gizmo {
  private readonly logger: Logger;
  // private readonly renderer: NebulaRenderer;
  // private readonly selection: SelectionSystem;
  // private readonly camera: Camera2D;
  // private readonly input: Input;

  // private readonly tmpLocal: Vec2;
  // private readonly pivotWorld: Vec2;

  // private readonly mT: Mat2;
  // private readonly mR: Mat2;
  // private readonly mA: Mat2;
  // private readonly m: Mat2;
  // private readonly m1: Mat2;
  // private readonly m2: Mat2;

  // private readonly handles: GizmoHandle[];
  // private active: GizmoHandle | null;

  // private dragStartWorld: Vec2;
  // private nodeStartPos: Vec2;

  // private axisX: Vec2;
  // private axisY: Vec2;

  private readonly tmpWorld: Vec2;
  private readonly ctx: GizmoContext;
  private readonly tools: GizmoTool[];

  public constructor(ctx: GizmoContext) {
    this.logger = createLogger(Gizmo.name);
    this.logger.log("Creating gizmo...");

    this.ctx = ctx;
    this.tmpWorld = new Vec2();

    // this.renderer = renderer;
    // this.selection = selection;
    // this.camera = camera;
    // this.input = input;

    // this.tmpLocal = new Vec2();
    // this.pivotWorld = new Vec2();

    // this.mT = Mat2.identity();
    // this.mR = Mat2.identity();
    // this.mA = Mat2.identity();
    // this.m = Mat2.identity();
    // this.m1 = Mat2.identity();
    // this.m2 = Mat2.identity();

    // this.dragStartWorld = new Vec2();
    // this.nodeStartPos = new Vec2();
    // this.axisX = new Vec2(1, 0);
    // this.axisY = new Vec2(0, 1);

    // this.active = null;
    // this.handles = [];

    // this.handles.push({ kind: "x", node: this.createHandleRect() });
    // this.handles.push({ kind: "y", node: this.createHandleRect() });
    // this.handles.push({ kind: "center", node: this.createHandleRect() });
  }

  // public onUpdate(): void {
  //   const selected: Node | null = this.selection.getSelected();

  //   if (!selected) {
  //     this.setHandlesVisible(false);
  //     this.active = null;
  //     return;
  //   }

  //   this.setHandlesVisible(true);
  //   this.updateHandle(selected);

  //   this.camera.screenToWorldTo(this.input.pointer.position, this.tmpWorld);

  //   if (this.active && this.input.pointer.released) {
  //     this.active = null;
  //   }
  // }

  // private createHandleRect(): RectNode {
  //   const r = this.renderer.createRect().setPickable(false);
  //   this.renderer.overlay.add(r);
  //   return r;
  // }

  // private getHandle(kind: GizmoHandleKind): GizmoHandle {
  //   for (let i = 0; i < this.handles.length; i++) {
  //     if (this.handles[i].kind === kind) {
  //       return this.handles[i];
  //     }
  //   }

  //   return this.handles[0];
  // }

  // private updateHandle(selected: Node): void {
  //   const wm: Mat2 = selected.worldMatrix;

  //   const zoom: number = this.camera.zoom;
  //   const len: number = 80 / zoom;
  //   const thick: number = 2 / zoom;
  //   const centerSize: number = 18 / zoom;

  //   const x: number = cos(selected.rotation);
  //   const y: number = sin(selected.rotation);
  //   const r: number = selected.rotation;

  //   const hx: GizmoHandle = this.getHandle("x");
  //   const hy: GizmoHandle = this.getHandle("y");
  //   const hCenter: GizmoHandle = this.getHandle("center");

  //   const nx: RectNode = hx.node;
  //   const ny: RectNode = hy.node;
  //   const nc: RectNode = hCenter.node;

  //   this.axisX.set(x, y);
  //   this.axisY.set(-y, x);
  //   this.pivotWorld.set(wm.tx, wm.ty);

  //   this.mT.setTranslate(this.pivotWorld.x, this.pivotWorld.y);
  //   this.mR.setRotate(r);
  //   this.mT.multTo(this.mR, this.m);

  //   this.mA.setTranslate(len * 0.5, 0);
  //   this.m.multTo(this.mA, this.m1);
  //   nx.setWorldMatrix(this.m1);

  //   this.mA.setTranslate(0, len * 0.5);
  //   this.m.multTo(this.mA, this.m2);
  //   ny.setWorldMatrix(this.m2);

  //   nc.setWorldMatrix(this.m);

  //   nx.setSize(len, thick).setFillColor(0xff3b3b).setStrokeColor(0xff3b3b);
  //   ny.setSize(thick, len).setFillColor(0x3bff3b).setStrokeColor(0x3bff3b);
  //   nc.setSize(centerSize, centerSize)
  //     .setFillColor(0x00ffcc)
  //     .setStrokeColor(0x00ffcc);
  // }

  // private setHandlesVisible(v: boolean): void {
  //   for (let i = 0; i < this.handles.length; i++) {
  //     this.handles[i].node.setFillColor(v ? 1 : 0).setAlpha(v ? 1 : 0);
  //   }
  // }
}
