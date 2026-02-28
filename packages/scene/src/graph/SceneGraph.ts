import { Node } from "../nodes";
import { DirtyQueue } from "./DirtyQueue";

export class SceneGraph {
  public readonly dirty: DirtyQueue<Node>;
  public readonly root: Node;

  public constructor() {
    this.dirty = new DirtyQueue<Node>();
    this.root = new Node(this.dirty, "root");
  }

  public flush(): void {
    while (this.dirty.length > 0) {
      const n = this.dirty.pop()!;
      this.ensureWorldUpToDate(n);
    }
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
}
