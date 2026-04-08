import { Bound, Vec2 } from "@atlasjs/math";

import { Renderer } from "../core";
import { SceneGraph } from "../scene";
import { Node, Sprite } from "../graphics";
import { SpriteRenderer } from "./SpriteRenderer";

export class SceneRenderer {
  private readonly renderer: Renderer;
  private readonly spriteRenderer: SpriteRenderer;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.spriteRenderer = new SpriteRenderer(renderer);
  }

  public render(scene: SceneGraph): void {
    const renderables: Node[] = this.getNodesArraySorted(scene.root);
    scene.updateWorldMatrices();

    this.renderer.beginFrame();
    this.renderNodes(renderables);
    this.renderer.endFrame();
  }

  private isSpriteVisible(sprite: Sprite): boolean {
    const viewport: Bound = this.renderer.getCameraViewport();
    const spriteBounds: Bound = sprite.getWorldBound();

    return viewport.overlaps(spriteBounds);
  }

  private getNodesArraySorted(root: Node): Node[] {
    const nodes: Node[] = [];
    this.collect(root, nodes);
    this.sort(nodes);
    return nodes;
  }

  private renderNodes(nodes: Node[]): void {
    for (let i = 0; i < nodes.length; i++) {
      this.drawNode(nodes[i]);
    }
  }

  private drawNode(node: Node): void {
    if (node instanceof Sprite) {
      this.spriteRenderer.drawSprite(node);
    }
  }

  private collect(node: Node, out: Node[]): void {
    if (!node.visible) return;

    if (node instanceof Sprite) {
      if (this.isSpriteVisible(node)) {
        out.push(node);
      }
    }

    const children: ReadonlyArray<Node> = node.getChildren();

    for (let i = 0; i < children.length; i++) {
      this.collect(children[i], out);
    }
  }

  private sort(nodes: Node[]): void {
    nodes.sort((a: Node, b: Node) => a.zIndex - b.zIndex);
  }
}
