import { Bound } from "@atlasjs/math";
import { Node, RectNode, Renderer } from "@atlasjs/render";
import { Picker } from "./Picker";
import { PickingEventPayload } from "./Events";

export class SelectionSystem {
  private selected: Node | null;
  private outline: RectNode | null;

  private readonly picker: Picker;
  private readonly renderer: Renderer;

  public constructor(picker: Picker, renderer: Renderer) {
    this.picker = picker;
    this.renderer = renderer;

    this.selected = null;
    this.outline = null;

    this.bind();
  }

  private bind(): void {
    this.picker.events.on("pick:down", ({ node }: PickingEventPayload) => {
      if (!node) {
        this.clear();
        return;
      }

      this.select(node);
    });
  }

  private select(node: Node): void {
    this.selected = node;

    const bound: Bound = this.selected.getLocalBound();

    console.log("Selected node bound:", bound);

    if (bound.isZero()) {
      this.clear();
      return;
    }

    if (!this.outline) {
      this.outline = this.renderer
        .createRect()
        .setFillAlpha(0)
        .setStrokeWidth(3)
        .setStrokeColor(0x00ffcc)
        .setStrokeAlpha(1)
        .setPosition(0, 0)
        .setSize(bound.width, bound.height);

      this.outline.setPickable(false);
    }

    if (this.outline.parent) {
      this.outline.parent.remove(this.outline);
    }

    node.add(this.outline);
  }

  private clear(): void {
    this.selected = null;
    if (this.outline?.parent) {
      this.outline.parent.remove(this.outline);
    }
  }
}
