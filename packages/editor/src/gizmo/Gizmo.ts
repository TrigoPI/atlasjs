import { Vec2 } from "@atlasjs/math";
import { Node } from "@atlasjs/nebula";
import { createLogger, Logger } from "@atlasjs/utils";

import { GizmoTool } from "./GizmoTool";
import { GizmoContext } from "./types";
import { PickingEventPayload } from "../picking";

export class Gizmo {
  private readonly logger: Logger;
  private readonly tmpWorld: Vec2;
  private readonly ctx: GizmoContext;
  private readonly tools: GizmoTool[];

  private captured: GizmoTool | null;

  public constructor(ctx: GizmoContext) {
    this.logger = createLogger(Gizmo.name);
    this.logger.log("Creating gizmo...");

    this.ctx = ctx;

    this.tools = [];
    this.tmpWorld = new Vec2();
    this.captured = null;

    ctx.picker.events.on("pick:down", ({ node }: PickingEventPayload) =>
      this.select(node),
    );
  }

  public register(tool: GizmoTool): this {
    this.tools.push(tool);
    tool.mount?.(this.ctx);
    return this;
  }

  public onUpdate(dt: number): void {
    this.updateWorld();
    this.updateTools(dt);
    this.updateCaptured();
  }

  public destroy(): void {
    while (this.tools.length) {
      const tool: GizmoTool | undefined = this.tools.pop();
      tool?.unmount?.(this.ctx);
    }
  }

  private select(n: Node | null): void {
    this.captured = this.getCapturedTool();

    if (this.captured) {
      this.captured.begin?.(this.tmpWorld, this.ctx);
      return;
    }

    this.onSelectionChange(n);
  }

  private getCapturedTool(): GizmoTool | null {
    for (const tool of this.tools) {
      if (tool.hit?.(this.tmpWorld, this.ctx)) {
        return tool;
      }
    }

    return null;
  }

  private onSelectionChange(n: Node | null): void {
    this.ctx.selected = n;
    this.logger.log(`Selected node: ${this.ctx.selected?.id}`);

    for (let i: number = 0; i < this.tools.length; i++) {
      const tool = this.tools[i];
      tool.onSelectionChange(this.ctx.selected, this.ctx);
    }
  }

  private updateWorld(): void {
    this.ctx.camera.screenToWorldInto(
      this.ctx.input.pointer.position,
      this.tmpWorld,
    );
  }

  private updateTools(dt: number): void {
    for (let i: number = 0; i < this.tools.length; i++) {
      const tool = this.tools[i];
      tool.onUpdate(this.ctx, { dt, pointerWorld: this.tmpWorld });
    }
  }

  private updateCaptured(): void {
    if (!this.captured) {
      return;
    }

    if (this.ctx.input.pointer.down) {
      this.captured.drag?.(this.tmpWorld, this.ctx);
    }

    if (this.ctx.input.pointer.released) {
      this.captured.end?.(this.ctx);
    }
  }
}
