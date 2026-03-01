import { Observable } from "@atlasjs/utils";
import { DirtyQueue, DirtyItem } from "../graph";

import {
  Bound,
  Mat2,
  ObservableTransform2D,
  ObservalbeVec2,
  Vec2,
  Vec2Like,
} from "@atlasjs/math";

export class Node implements DirtyItem {
  public pickable: boolean;

  public readonly id: string;
  public readonly kind: string;
  public readonly transform: ObservableTransform2D;

  protected readonly local: Mat2;
  protected readonly world: Mat2;
  protected readonly invWorld: Mat2;

  protected localDirty: boolean;
  protected worldDirty: boolean;
  protected invDirty: boolean;

  protected _parent: Node | null;
  protected _children: Node[];

  private readonly dirty: DirtyQueue<Node>;
  private readonly transformObserver: Observable;

  private queued: boolean;

  public constructor(dirty: DirtyQueue<Node>, id?: string) {
    this.kind = "node";
    this.dirty = dirty;
    this.id = id ?? crypto.randomUUID();

    this._parent = null;
    this._children = [];

    this.queued = false;
    this.pickable = true;

    this.localDirty = true;
    this.worldDirty = true;
    this.invDirty = true;

    this.local = Mat2.identity();
    this.world = Mat2.identity();
    this.invWorld = Mat2.identity();

    this.transformObserver = Observable.from(() => this.markSubTreeDirty());
    this.transform = ObservableTransform2D.create(this.transformObserver);

    this.markSubTreeDirty();
  }

  public set rotation(value: number) {
    this.transform.rotation = value;
  }

  public get rotation(): number {
    return this.transform.rotation;
  }

  public get position(): ObservalbeVec2 {
    return this.transform.position;
  }

  public get scale(): ObservalbeVec2 {
    return this.transform.scale;
  }

  public get parent(): Node | null {
    return this._parent;
  }

  public get children(): ReadonlyArray<Node> {
    return this._children;
  }

  public get worldMatrix(): Readonly<Mat2> {
    return this.world;
  }

  public isQueued(): boolean {
    return this.queued;
  }

  public isWorldDirty(): boolean {
    return this.worldDirty || this.localDirty;
  }

  public toString(indent: number = 0): string {
    const pad: string = "  ".repeat(indent);
    const nodeInfo: string = `${pad}- Node(${this.id})`;
    if (this._children.length === 0) return nodeInfo;
    const childrenInfo: string = this._children
      .map((child: Node) => child.toString(indent + 1))
      .join("\n");

    return `${nodeInfo}\n${childrenInfo}`;
  }

  public getWorldMatrix(): Readonly<Mat2> {
    return this.world;
  }

  public worldToLocal(world: Vec2Like): Vec2 {
    this.ensureInvWorld();
    return this.invWorld.multVec2(world);
  }

  public localToWorld(local: Vec2Like): Vec2 {
    return this.world.multVec2(local);
  }

  public getLocalBound(): Bound {
    return Bound.create();
  }

  public hitTestLocal(_p: Vec2): boolean {
    return false;
  }

  public setPickable(pickable: boolean): this {
    this.pickable = pickable;
    return this;
  }

  public setWorldMatrix(m: Mat2): this {
    this.world.copyFrom(m);
    return this;
  }

  public setPosition(x: number, y: number): this {
    this.transform.position.set(x, y);
    this.markSubTreeDirty();
    return this;
  }

  public setScale(x: number, y: number): this {
    this.transform.scale.set(x, y);
    this.markSubTreeDirty();
    return this;
  }

  public setRotation(r: number): this {
    this.transform.rotation = r;
    this.markSubTreeDirty();
    return this;
  }

  public add(child: Node): this {
    if (this === child) throw new Error("Cannot add self");
    if (this.wouldCreateCycle(child)) throw new Error("Cycle");

    if (child._parent) child._parent.remove(child);

    this._children.push(child);
    child._parent = this;

    return this;
  }

  public remove(child: Node): this {
    const i = this._children.indexOf(child);
    if (i === -1) return this;
    this._children.splice(i, 1);
    child._parent = null;
    child.markSubTreeDirty();
    return this;
  }

  public worldToLocalTo(world: Vec2Like, out: Vec2Like): void {
    this.ensureInvWorld();
    this.invWorld.multVec2To(world, out);
  }

  public localToWorldTo(local: Vec2Like, out: Vec2Like): void {
    this.world.multVec2To(local, out);
  }

  public markQueued(): void {
    this.queued = true;
  }

  public markUnqueued(): void {
    this.queued = false;
  }

  public recomputeWorldFromParent(parent: Node | null): void {
    if (!this.isWorldDirty() && (!parent || !parent.isWorldDirty())) return;

    this.recomputeLocalIfNeeded();

    if (!parent) this.world.copyFrom(this.local);
    else this.world.copyFrom(parent.world).mult(this.local);

    this.worldDirty = false;
    this.invDirty = true;
  }

  public recomputeLocalIfNeeded(): void {
    if (!this.localDirty) return;
    this.local.fromTransform2D(this.transform);
    this.localDirty = false;
  }

  private wouldCreateCycle(child: Node): boolean {
    let cur: Node | null = this;

    while (cur) {
      if (cur === child) return true;
      cur = cur.parent;
    }

    return false;
  }

  private markSubTreeDirty(): void {
    this.localDirty = true;
    this.worldDirty = true;
    this.invDirty = true;
    this.dirty.push(this);

    for (let i: number = 0; i < this._children.length; i++) {
      this._children[i].markSubTreeDirty();
    }
  }

  private ensureInvWorld(): void {
    if (!this.invDirty) return;
    this.invDirty = false;
    this.invWorld.copyFrom(this.world).invert();
  }
}
