import { Vec2, Vec2Like } from "@atlasjs/math";
import { Camera2D, Node } from "@atlasjs/render";
import { EventBus } from "@atlasjs/core";
import { Input } from "@atlasjs/input";

import { PickingEvents } from "./Events";

export class Picker {
  private readonly tmpLocal: Vec2;
  private readonly tmpWorld: Vec2;

  private readonly root: Node;
  private readonly camera: Camera2D;
  private readonly input: Input;
  private readonly events: EventBus<PickingEvents>;

  private hoveredId: string | null = null;

  public constructor(root: Node, camera: Camera2D, input: Input) {
    this.root = root;
    this.input = input;
    this.camera = camera;

    this.hoveredId = null;

    this.tmpLocal = new Vec2();
    this.tmpWorld = new Vec2();

    this.events = new EventBus<PickingEvents>();
  }

  public onUpdate(): void {
    const screen: Vec2 = this.input.pointer.position;
    const world: Vec2 = this.camera.screenToWorld(screen);

    this.tmpWorld.copyFrom(world);

    const hit: Node | null = this.pickFrom(this.root, this.tmpWorld);
    const hitId: string | null = hit?.id ?? null;

    if (hitId !== this.hoveredId) {
      if (hitId) {
        this.events.emit("pick:hoverEnter", {
          nodeId: hitId,
          world: this.tmpWorld.copy(),
        });
      }
    }
  }

  private pickFrom(node: Node, pWorld: Vec2Like): Node | null {
    const children: readonly Node[] = node.children;

    for (let i = children.length - 1; i >= 0; i--) {
      const got: Node | null = this.pickFrom(children[i], pWorld);
      if (got) return got;
    }

    if (!node.pickable) {
      return null;
    }

    const local: Vec2 = node.worldToLocal(pWorld);
    this.tmpLocal.copyFrom(local);

    return node.hitTestLocal(this.tmpLocal) ? node : null;
  }
}
