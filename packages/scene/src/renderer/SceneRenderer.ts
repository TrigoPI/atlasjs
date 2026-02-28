import { CommandBuffer, Renderer, ViewState } from "@atlasjs/renderer";

import { SceneGraph } from "../graph";
import { Overlay } from "../overlay";
import { RectNode, Node, SpriteNode } from "../nodes";

export class SceneRenderer {
  private readonly overlay: Overlay;
  private readonly scene: SceneGraph;
  private readonly renderer: Renderer;
  private readonly cmds: CommandBuffer;

  public constructor(
    scene: SceneGraph,
    renderer: Renderer,
    cmds: CommandBuffer,
    overlay: Overlay,
  ) {
    this.cmds = cmds;
    this.scene = scene;
    this.renderer = renderer;
    this.overlay = overlay;
  }

  public onFlush(): void {
    this.cmds.clear();
    this.scene.flush();
  }

  public onSync(): void {
    this.traverse(this.scene.root);
    this.traverseOverlay(this.overlay);
  }

  public onRender(view: ViewState): void {
    this.renderer.beginFrame();
    this.renderer.setView(view);
    this.renderer.submit(this.cmds);
    this.renderer.endFrame();
  }

  private traverseOverlay(overlay: Overlay): void {
    for (let i: number = 0; i < overlay.nodes.length; i++) {
      const node: Node = overlay.nodes[i];
      this.traverse(node);
    }
  }

  private traverse(n: Node): void {
    const children: readonly Node[] = n.children;

    if (n.kind === "rect") {
      const r: RectNode = <RectNode>n;
      this.cmds.drawRect({
        height: r.height,
        width: r.width,
        world: r.getWorldMatrix(),
        fill: r.getFill(),
        stroke: r.getStroke(),
      });
    }

    if (n.kind === "sprite") {
      const s: SpriteNode = <SpriteNode>n;
      this.cmds.drawSprite({
        world: s.getWorldMatrix(),
        texture: s.getTexture(),
        alpha: s.getAlpha(),
      });
    }

    for (let i = 0; i < children.length; i++) {
      this.traverse(children[i]);
    }
  }
}
