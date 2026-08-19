import type { NebulaRenderer, ShapeNode } from "@atlasjs/nebula";

export const GIZMO_SORTING_LAYER: number = 1_000_000;

export class NodeRing<T extends ShapeNode> {
  private readonly nebula: NebulaRenderer;
  private readonly create: () => T;
  private readonly nodes: T[];
  private cursor: number;

  public constructor(nebula: NebulaRenderer, create: () => T) {
    this.nebula = nebula;
    this.create = create;
    this.nodes = [];
    this.cursor = 0;
  }

  public acquire(): T {
    if (this.cursor === this.nodes.length) {
      const created: T = this.create();
      created.sortingLayer = GIZMO_SORTING_LAYER;
      this.nebula.scene.addChild(created);
      this.nodes.push(created);
    }

    const node: T = this.nodes[this.cursor];
    this.cursor += 1;
    node.setVisible(true);

    return node;
  }

  public hideUnused(): void {
    for (let i: number = this.cursor; i < this.nodes.length; i += 1) {
      this.nodes[i].setVisible(false);
    }
  }

  public reset(): void {
    this.cursor = 0;
  }

  public dispose(): void {
    for (const node of this.nodes) {
      node.removeFromParent();
    }

    this.nodes.length = 0;
    this.cursor = 0;
  }
}
