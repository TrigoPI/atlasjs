import { Node } from "../graphics";

export class SceneGraph {
  public readonly root: Node;

  public constructor() {
    this.root = new Node();
  }

  public addChild(node: Node): this {
    this.root.addChild(node);
    return this;
  }

  public updateWorldMatrices(): void {
    this.root.updateWorldMatrix();
  }

  public traverse(callback: (node: Node) => void): void {
    this.root.traverse(callback);
  }
}
