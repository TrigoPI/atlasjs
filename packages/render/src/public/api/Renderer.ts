import { EventBus } from "@atlasjs/core";

import { IContainerDriver, IRectDriver, IRendererBackend } from "../../backend";
import { ContainerNode, Node, RectNode, RendererLike } from "./nodes";
import { RendererEvents } from "../events";
import { RectStyle } from "../types";

export class Renderer implements RendererLike {
  public readonly root: ContainerNode;
  public readonly events: EventBus<RendererEvents>;

  private readonly backend: IRendererBackend;
  private readonly dirtyTransformQueue: Node[];

  public constructor(backend: IRendererBackend) {
    this.dirtyTransformQueue = [];
    this.backend = backend;

    this.events = new EventBus<RendererEvents>();
    this.root = new ContainerNode(backend.root(), this, "root");

    this.events.emit("node:created", { id: this.root.id, kind: "root" });
    this.root.onDirty(() => this.addDirtyTransform(this.root));
  }

  public flushDirtyTransform(): void {
    for (let i: number = this.dirtyTransformQueue.length - 1; i >= 0; i--) {
      const node: Node = this.dirtyTransformQueue[i];
      node.flushTransform();
      node.markUnqueued();
      this.dirtyTransformQueue.pop();
    }
  }

  public createContainer(id?: string): ContainerNode {
    const driver: IContainerDriver = this.backend.createContainer();
    const container: ContainerNode = new ContainerNode(driver, this, id);

    container.onDirty(() => this.addDirtyTransform(container));
    this.events.emit("node:created", { id: container.id, kind: "container" });

    return container;
  }

  public createRect(style: RectStyle, id?: string): RectNode {
    const driver: IRectDriver = this.backend.createRect(style);
    const rect: RectNode = new RectNode(driver, this, id);

    rect.onDirty(() => this.addDirtyTransform(rect));
    this.events.emit("node:created", { id: rect.id, kind: "rect" });

    return rect;
  }

  private addDirtyTransform(node: Node): void {
    if (node.isQueued()) return;
    node.markQueued();
    this.dirtyTransformQueue.push(node);
  }
}
