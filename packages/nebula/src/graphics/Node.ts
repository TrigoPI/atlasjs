import { Mat4 } from "@atlasjs/math";
import { Transformable } from "./Transformable";
import { TraverseCallback } from "./graphics-types";

export class Node extends Transformable {
  public visible: boolean;
  public zIndex: number;

  private readonly children: Node[];
  private parent: Node | null;

  public constructor() {
    super();

    this.zIndex = 0;
    this.visible = true;
    this.children = [];

    this.parent = null;
  }

  public getChildren(): ReadonlyArray<Node> {
    return this.children;
  }

  public getParent(): Node | null {
    return this.parent;
  }

  public addChild(node: Node): this {
    if (node === this) {
      throw new Error("A node cannot add itself as a child.");
    }

    if (this.isDescendantOf(node)) {
      throw new Error("Cannot add an ancestor as a child.");
    }

    if (node.parent) {
      node.parent.removeChild(node);
    }

    node.parent = this;
    this.children.push(node);

    return this;
  }

  public removeChild(node: Node): this {
    const index: number = this.children.indexOf(node);

    if (index === -1) {
      throw new Error("Node is not a child.");
    }

    this.children.splice(index, 1);
    node.parent = null;

    return this;
  }

  public removeFromParent(): this {
    this.parent?.removeChild(this);
    return this;
  }

  public setZIndex(zIndex: number): this {
    this.zIndex = zIndex;
    return this;
  }

  public traverse(callback: TraverseCallback): void {
    callback(this);

    for (let i: number = 0; i < this.children.length; i++) {
      this.children[i].traverse(callback);
    }
  }

  public updateWorldMatrix(parentWorld?: Mat4): void {
    if (parentWorld) {
      this.transformMatrix.identity().fromTransform2D(this.transform);
      this.worldMatrix.copy(parentWorld).multiply(this.transformMatrix);
    } else {
      this.worldMatrix.identity().fromTransform2D(this.transform);
    }

    for (let i: number = 0; i < this.children.length; i++) {
      this.children[i].updateWorldMatrix(this.worldMatrix);
    }
  }

  private isDescendantOf(node: Node): boolean {
    let current: Node | null = this.parent;

    while (current) {
      if (current === node) {
        return true;
      }

      current = current.parent;
    }

    return false;
  }
}
