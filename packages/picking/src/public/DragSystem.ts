import { Node } from "@atlasjs/render";
import { Input } from "@atlasjs/input";
import { Vec2 } from "@atlasjs/math";

import { Picker } from "./Picker";
import { PickingEventPayload } from "./Events";

export class DragSystem {
  private dragged: Node | null;
  private enabled: boolean;

  private readonly picker: Picker;
  private readonly input: Input;

  private readonly offsetWorld: Vec2;
  private readonly tmp: Vec2;

  public constructor(picker: Picker, input: Input) {
    this.picker = picker;
    this.input = input;

    this.dragged = null;
    this.enabled = true;

    this.offsetWorld = new Vec2();
    this.tmp = new Vec2();

    this.bind();
  }

  private bind(): void {
    this.picker.events.on(
      "pick:down",
      ({ node, world }: PickingEventPayload): void => {
        if (!node) return;

        this.dragged = node;

        this.tmp.set(0, 0);
        node.localToWorldInto(this.tmp, this.tmp);
        Vec2.subInto(this.tmp, world, this.offsetWorld);
      },
    );

    this.picker.events.on(
      "pick:move",
      ({ world }: PickingEventPayload): void => {
        if (!this.enabled) return;
        if (!this.dragged) return;
        if (!this.input.pointer.down) return;

        const target: Vec2 = Vec2.add(world, this.offsetWorld);
        const parent: Node | null = this.dragged.parent;

        if (parent) {
          parent.worldToLocalInto(target, this.tmp);
          this.dragged.setPosition(this.tmp.x, this.tmp.y);
        } else {
          this.dragged.setPosition(target.x, target.y);
        }
      },
    );

    this.picker.events.on("pick:up", () => {
      if (!this.enabled) return;
      this.dragged = null;
    });
  }
}
