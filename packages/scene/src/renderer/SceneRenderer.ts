import { CommandBuffer, Renderer, ViewState } from "@atlasjs/renderer";

import { SceneGraph } from "../graph";
import { Node, RectNode, SpriteNode } from "../nodes";

export class SceneRenderer {
  private readonly graph: SceneGraph;
  private readonly renderer: Renderer;
  private readonly cmds: CommandBuffer;

  public constructor(
    graph: SceneGraph,
    renderer: Renderer,
    cmds: CommandBuffer,
  ) {
    this.graph = graph;
    this.renderer = renderer;
    this.cmds = cmds;
  }

  public render(view: ViewState): void {
    this.graph.flush();
    this.cmds.clear();

    this.traverse(this.graph.root);
    this.traverse(this.graph.overlay);

    this.renderer.beginFrame();
    this.renderer.setView(view);
    this.renderer.submit(this.cmds);
    this.renderer.endFrame();
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
