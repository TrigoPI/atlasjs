import { EventBus } from "@atlasjs/core";
import { Box2, Mat2, Transform2D } from "@atlasjs/math";

import { IRectDriver, IRendererBackend, ISpriteDriver } from "../../backend";
import { RendererLike } from "../../internal";
import { RendererEvents } from "../events";
import { RectStyle } from "../types";

import { Camera2D, ObservableCamera2D } from "./camera";
import { Node, RectNode, SpriteNode } from "./nodes";
import { Observable } from "@atlasjs/utils";

export class Renderer implements RendererLike {
  public readonly root: Node;
  public readonly events: EventBus<RendererEvents>;
  private readonly _camera: ObservableCamera2D;

  private readonly backend: IRendererBackend;
  private readonly dirtyTransformQueue: Node[];

  public constructor(backend: IRendererBackend) {
    this.dirtyTransformQueue = [];
    this.backend = backend;

    this.events = new EventBus<RendererEvents>();
    this._camera = new ObservableCamera2D(backend.getCamera());

    this.root = new Node({
      id: "root",
      isRoot: true,
      driver: backend.root(),
      localMatrix: new Mat2(),
      worldMatrix: new Mat2(),
      transform: new Transform2D(),
      dirtyObserver: this.createDirtyObserver(),
      renderer: this,
      backend,
    });

    this.events.emit("node:created", { id: this.root.id, kind: "root" });
  }

  public get camera(): Camera2D {
    return this._camera;
  }

  public getSurfaceSize(): Box2 {
    return this.backend.getSurfaceSize();
  }

  public setViewportSize(width: number, height: number): void {
    this._camera.setViewportSize(width, height);
  }

  public flushCamera(): void {
    if (this._camera.isDirty()) {
      this._camera.flush();
    }
  }

  public createRect(style: RectStyle, id?: string): RectNode {
    const driver: IRectDriver = this.backend.createRect(style);
    const rect: RectNode = new RectNode({
      backend: this.backend,
      renderer: this,
      localMatrix: new Mat2(),
      worldMatrix: new Mat2(),
      transform: new Transform2D(),
      dirtyObserver: this.createDirtyObserver(),
      driver,
      id,
    });

    this.events.emit("node:created", { id: rect.id, kind: "rect" });

    return rect;
  }

  public createSprite(id?: string): SpriteNode {
    const driver: ISpriteDriver = this.backend.createSprite();
    const sprite: SpriteNode = new SpriteNode({
      renderer: this,
      backend: this.backend,
      localMatrix: new Mat2(),
      worldMatrix: new Mat2(),
      transform: new Transform2D(),
      dirtyObserver: this.createDirtyObserver(),
      driver,
      id,
    });

    this.events.emit("node:created", { id: sprite.id, kind: "sprite" });

    return sprite;
  }

  public flushWorldTransforms(): void {
    while (this.dirtyTransformQueue.length > 0) {
      const n = this.dirtyTransformQueue.pop()!;
      n.markUnqueued();
      this.ensureWorldUpToDate(n);
    }
  }

  private addDirtyTransform(node: Node): void {
    if (node.isQueued()) return;
    node.markQueued();
    this.dirtyTransformQueue.push(node);
  }

  private ensureWorldUpToDate(n: Node): void {
    const stack: Node[] = [];
    let cur: Node | null = n;

    while (cur && cur.isWorldDirty()) {
      stack.push(cur);
      cur = cur.parent;
    }

    for (let i = stack.length - 1; i >= 0; i--) {
      const node: Node = stack[i];
      node.recomputeWorldFromParent(node.parent);
    }
  }

  private createDirtyObserver(): Observable<Node> {
    return Observable.from((node: Node) => {
      this.addDirtyTransform(node);
    });
  }
}
