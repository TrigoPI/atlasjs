import { Bound, Mat2, Vec2 } from "@atlasjs/math";
import { createLogger, Logger } from "@atlasjs/utils";
import { Unsubscribe } from "@atlasjs/core";
import { NebulaRenderer, RectNode, Node } from "@atlasjs/nebula";

import { Picker } from "./Picker";
import { PickingEventPayload } from "./Events";

export class SelectionSystem {
  private logger: Logger;

  private selected: Node | null;
  private outline: RectNode | null;

  private readonly picker: Picker;
  private readonly renderer: NebulaRenderer;
  private readonly unsubscribe: Unsubscribe[];

  private readonly m1: Mat2;
  private readonly m: Mat2;
  private readonly s: Mat2;

  public constructor(picker: Picker, renderer: NebulaRenderer) {
    this.logger = createLogger(SelectionSystem.name);

    this.picker = picker;
    this.renderer = renderer;

    this.unsubscribe = [];
    this.selected = null;
    this.outline = null;

    this.m1 = Mat2.identity();
    this.m = Mat2.identity();
    this.s = Mat2.identity();

    this.bind();
  }

  public onUpdate(): void {
    this.updateOutline();
  }

  public destroy(): void {
    this.logger.log("Destroying selection system...");
    this.clear();
    this.unsubscribe.forEach((unsubscribe: Unsubscribe) => unsubscribe());
  }

  private bind(): void {
    this.unsubscribe.push(
      this.picker.events.on("pick:down", ({ node }: PickingEventPayload) => {
        if (!node) {
          this.clear();
          return;
        }

        this.select(node);
      }),
    );
  }

  private select(node: Node): void {
    this.selected = node;

    const bound: Bound = this.selected.getLocalBound();

    if (bound.isZero()) {
      this.clear();
      return;
    }

    if (!this.outline) {
      this.logger.log(`Creating selection outline for ${node.id}`);

      this.outline = this.renderer
        .createRect()
        .setAlpha(0)
        .setStrokeWidth(8)
        .setStrokeColor(0x00ffcc)
        .setStrokeAlpha(1);

      this.outline.pickable = false;
      this.renderer.overlay.add(this.outline);
    }

    this.updateOutline();
  }

  private updateOutline(): void {
    if (!this.selected || !this.outline) return;

    const b: Bound = this.selected.getLocalBound();
    if (b.isZero()) return this.clear();

    const cx: number = b.x + b.width * 0.5;
    const cy: number = b.y + b.height * 0.5;

    this.outline.setSize(b.width, b.height);
    this.m1.setTranslate(cx, cy);

    this.selected.worldMatrix.multTo(this.m1, this.m);
    this.outline.worldMatrix.copyFrom(this.m);
  }

  private clear(): void {
    if (this.outline?.parent) {
      this.outline.parent.remove(this.outline);
    }

    this.selected = null;
    this.outline = null;
  }
}
