import { Camera2D, Node } from "@atlasjs/nebula";
import { createLogger, Logger } from "@atlasjs/utils";
import { EventBus } from "@atlasjs/core";
import { Input } from "@atlasjs/input";
import { Vec2 } from "@atlasjs/math";

import { PickingEvents } from "./Events";

export class Picker {
  public readonly events: EventBus<PickingEvents>;

  private readonly logger: Logger;
  private readonly tmpLocal: Vec2;
  private readonly tmpWorld: Vec2;
  private readonly root: Node;
  private readonly camera: Camera2D;
  private readonly input: Input;

  private hoveredNode: Node | null = null;

  public constructor(root: Node, camera: Camera2D, input: Input) {
    this.logger = createLogger(Picker.name);

    this.root = root;
    this.input = input;
    this.camera = camera;

    this.hoveredNode = null;

    this.tmpLocal = new Vec2();
    this.tmpWorld = new Vec2();

    this.events = new EventBus<PickingEvents>();
  }

  public onUpdate(): void {
    const screen: Vec2 = this.input.pointer.position;
    this.camera.screenToWorldTo(screen, this.tmpWorld);

    const hit: Node | null = this.pickFrom(this.root, this.tmpWorld);
    const hitId: string | undefined = hit?.id;
    const hoveredId: string | undefined = this.hoveredNode?.id;

    this.updateEnterLeave(hit, hitId, hoveredId);
    this.updatePickMove(hit);
    this.updatePickUpDown(hit);
  }

  public destroy(): void {
    this.logger.log("Destroying picker...");
    this.events.clear();
  }

  private pickFrom(node: Node, pWorld: Vec2): Node | null {
    const children: readonly Node[] = node.children;

    for (let i = children.length - 1; i >= 0; i--) {
      const got: Node | null = this.pickFrom(children[i], pWorld);
      if (got) return got;
    }

    if (!node.pickable) {
      return null;
    }

    node.worldToLocalTo(pWorld, this.tmpLocal);
    return node.hitTestLocal(this.tmpLocal) ? node : null;
  }

  private updateEnterLeave(
    hit: Node | null,
    hitId: string | undefined,
    hoveredId: string | undefined,
  ): void {
    if (hitId === hoveredId) {
      return;
    }

    if (hoveredId) {
      this.events.emit("pick:hoverLeave", {
        node: <Node>this.hoveredNode,
        world: this.tmpWorld.copy(),
      });
    }

    if (hitId) {
      this.events.emit("pick:hoverEnter", {
        node: <Node>hit,
        world: this.tmpWorld.copy(),
      });
    }

    this.hoveredNode = hit;
  }

  private updatePickMove(hit: Node | null): void {
    if (this.input.pointer.delta.x === 0 && this.input.pointer.delta.y === 0) {
      return;
    }

    this.events.emit("pick:move", {
      node: <Node>hit,
      world: this.tmpWorld.copy(),
    });
  }

  private updatePickUpDown(hit: Node | null): void {
    if (this.input.pointer.pressed) {
      this.events.emit("pick:down", {
        node: hit,
        world: this.tmpWorld.copy(),
      });
    }

    if (this.input.pointer.released) {
      this.events.emit("pick:up", {
        node: hit,
        world: this.tmpWorld.copy(),
      });
    }
  }
}
