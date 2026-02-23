import { Observable } from "@atlasjs/utils";

import { RendererLike } from "../../../internal";
import { NodeConstructorOptions } from "./types";

import {
  Mat2,
  ObservableTransform2D,
  Transform2D,
  Vec2,
  Vec2Like,
} from "@atlasjs/math";

import {
  IContainerDriver,
  INodeDriver,
  IRendererBackend,
} from "../../../backend";

export class Node<TDriver extends INodeDriver = INodeDriver> {
  public readonly id: string;
  public readonly driver: TDriver;

  protected readonly _transform: ObservableTransform2D;
  protected readonly localMatrix: Mat2;
  protected readonly worldMatrix: Mat2;
  protected readonly renderer: RendererLike;
  protected readonly backend: IRendererBackend;
  protected readonly invWorldMatrix: Mat2;

  private dead: boolean;
  private queued: boolean;
  private localDirty: boolean;
  private worldDirty: boolean;
  private invDirty: boolean;

  private _parent: Node | null;
  private _group: IContainerDriver | null;

  private readonly transformObserver: Observable;
  private readonly dirtyObserver: Observable<Node>;
  private readonly _children: Node[];

  constructor({
    driver,
    renderer,
    transform,
    localMatrix,
    worldMatrix,
    backend,
    dirtyObserver,
    isRoot = false,
    id = crypto.randomUUID(),
  }: NodeConstructorOptions<TDriver>) {
    this.id = id;
    this.driver = driver;
    this.backend = backend;
    this.renderer = renderer;
    this.dirtyObserver = dirtyObserver;
    this.localMatrix = localMatrix;
    this.worldMatrix = worldMatrix;

    this.dead = false;
    this.queued = false;
    this.localDirty = true;
    this.worldDirty = true;
    this.invDirty = true;

    this._group = this.createRootDriverOrNull(isRoot, driver);
    this._parent = null;
    this._children = [];

    this.invWorldMatrix = new Mat2();
    this.transformObserver = new Observable();

    this._transform = ObservableTransform2D.from(
      this.transformObserver,
      transform,
    );

    this.transformObserver.bind(() => {
      this.localDirty = true;
      this.markSubTreeWorldDirty();
    });

    this.markSubTreeWorldDirty();
  }

  public get children(): readonly Node[] {
    return this._children;
  }

  public get parent(): Node | null {
    return this._parent;
  }

  public get transform(): Transform2D {
    return this._transform;
  }

  public get rotation(): number {
    return this.transform.rotation;
  }

  public set rotation(r: number) {
    this._transform.rotation = r;
  }

  public get scale(): Vec2 {
    return this.transform.scale;
  }

  public get position(): Vec2 {
    return this.transform.position;
  }

  public get pickable(): boolean {
    return true;
  }

  public isWorldDirty(): boolean {
    return this.worldDirty || this.localDirty;
  }

  public isQueued(): boolean {
    return this.queued;
  }

  public hasGroup(): boolean {
    return this._group !== null;
  }

  public hitTestLocal(p: Vec2Like): boolean {
    return false;
  }

  public linkDriver(): INodeDriver {
    return this._group ?? this.driver;
  }

  public worldToLocal(world: Vec2Like): Vec2Like {
    this.ensureInvWorld();
    return this.invWorldMatrix.multVec2(world);
  }

  public setPosition(x: number, y: number): Node {
    this.assertAlive();
    this._transform.setPosition(x, y);
    return this;
  }

  public setRotation(r: number): Node {
    this.assertAlive();
    this._transform.setRotation(r);
    return this;
  }

  public setScale(x: number, y: number): Node {
    this.assertAlive();
    this._transform.setScale(x, y);
    return this;
  }

  public setTransform(t: Transform2D): Node {
    this.assertAlive();
    this._transform.setPosition(t.position.x, t.position.y);
    this._transform.setScale(t.scale.x, t.scale.y);
    this._transform.setRotation(t.rotation);
    return this;
  }

  public setVisible(v: boolean): Node {
    this.assertAlive();
    this.driver.setVisible(v);
    this.renderer.events.emit("node:visibleChanged", {
      id: this.id,
      visible: v,
    });

    return this;
  }

  public setAlpha(a: number): Node {
    this.assertAlive();
    this.driver.setAlpha(a);
    this.renderer.events.emit("node:alphaChanged", {
      id: this.id,
      alpha: a,
    });

    return this;
  }

  public add(child: Node): Node {
    this.assertAlive();
    child.assertAlive();

    if (child === this) {
      throw new Error("Cannot add self as child");
    }

    if (this.wouldCreateCycle(child)) {
      throw new Error("Adding this child would create a cycle");
    }

    if (child._parent) {
      child._parent.remove(child);
    }

    const group: IContainerDriver = this.attachContainer();

    this._children.push(child);
    child._parent = this;

    group.add(child.linkDriver());
    child.markSubTreeWorldDirty();

    return this;
  }

  public remove(child: Node): Node {
    this.assertAlive();

    const i: number = this._children.indexOf(child);
    if (i === -1) return this;

    this._children.splice(i, 1);
    child._parent = null;

    if (this._group) {
      this._group.remove(child.linkDriver());
    }

    child.markSubTreeWorldDirty();
    return this;
  }

  public destroy(): void {
    if (this.dead) {
      return;
    }

    this.dead = true;

    if (this._parent) {
      this._parent.remove(this);
    }

    for (let i: number = this._children.length - 1; i >= 0; i--) {
      const child: Node = this._children.pop()!;
      child.destroy();
    }

    this.driver.destroy();

    if (this._group) {
      this._group.destroy();
      this._group = null;
    }

    this.renderer.events.emit("node:destroyed", {
      id: this.id,
    });
  }

  public markQueued(): void {
    this.queued = true;
  }

  public markUnqueued(): void {
    this.queued = false;
  }

  public markSubTreeWorldDirty(): void {
    this.markWorldDirty();
    for (let i: number = 0; i < this._children.length; i++) {
      this._children[i].markSubTreeWorldDirty();
    }
  }

  public recomputeLocalIfNeeded(): void {
    if (!this.localDirty) return;
    this.localMatrix.fromTransform2D(this._transform);
    this.localDirty = false;
  }

  public recomputeWorldFromParent(parent: Node | null): void {
    if (this.dead) return;
    if (!this.isWorldDirty() && (!parent || !parent.isWorldDirty())) return;

    this.recomputeLocalIfNeeded();

    if (!parent) {
      this.worldMatrix.copyFrom(this.localMatrix);
    } else {
      this.worldMatrix.copyFrom(parent.worldMatrix).mult(this.localMatrix);
    }

    const target: INodeDriver = this._group ?? this.driver;
    target.setLocalTransform(this._transform);

    this.worldDirty = false;
    this.markInvDirty();

    if (this._children.length > 0) {
      for (let i = 0; i < this._children.length; i++) {
        this._children[i].markWorldDirty();
      }
    }
  }

  private assertAlive() {
    if (this.dead) {
      throw new Error(`Node "${this.id}" is destroyed`);
    }
  }

  private wouldCreateCycle(child: Node): boolean {
    let cur: Node | null = this;

    while (cur) {
      if (cur === child) return true;
      cur = cur.parent;
    }

    return false;
  }

  private attachContainer(): IContainerDriver {
    return this.ensureGroup();
  }

  private ensureGroup(): IContainerDriver {
    if (this._group) {
      return this._group;
    }

    const group: IContainerDriver = this.backend.createContainer();
    this._group = group;

    if (this._parent) {
      const parentContainer: IContainerDriver = this._parent.attachContainer();
      parentContainer.remove(this.driver);
      parentContainer.add(group);
    }

    group.add(this.driver);

    for (let i: number = 0; i < this._children.length; i++) {
      group.add(this._children[i].linkDriver());
    }

    this.markWorldDirty();

    return group;
  }

  private ensureInvWorld(): void {
    if (!this.invDirty) return;
    this.invDirty = false;
    this.invWorldMatrix.copyFrom(this.worldMatrix).invert();
  }

  private markWorldDirty(): void {
    this.worldDirty = true;
    this.dirtyObserver.notifyChange(this);
  }

  private markInvDirty(): void {
    this.invDirty = true;
  }

  private createRootDriverOrNull(
    isRoot: boolean,
    driver: TDriver,
  ): IContainerDriver | null {
    if (!isRoot) return null;
    return driver as unknown as IContainerDriver;
  }
}
