import { Bound } from "@atlasjs/math";

import { PassDescriptor, Renderer } from "../core";
import { SceneGraph } from "../scene";
import { Node } from "../graphics";
import { RenderQueue } from "./RenderQueue";
import { SpriteRenderer } from "./SpriteRenderer";
import { ShapeRenderer } from "./ShapeRenderer";
import { TileMapNodeRenderer } from "./TileMapNodeRenderer";
import { NodeRenderer } from "./NodeRenderer";
import { DrawCommand } from "./DrawCommand";

export class SceneRenderer {
  private readonly renderer: Renderer;
  private readonly nodeRenderers: ReadonlyArray<NodeRenderer>;
  private readonly queue: RenderQueue;
  private readonly worldBoundScratch: Bound;

  private cameraViewport: Bound;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.queue = new RenderQueue();
    this.worldBoundScratch = new Bound();
    this.cameraViewport = new Bound();

    this.nodeRenderers = [
      new SpriteRenderer(renderer),
      new ShapeRenderer(),
      new TileMapNodeRenderer(renderer),
    ];

    for (let i: number = 0; i < this.nodeRenderers.length; i++) {
      const nr: NodeRenderer = this.nodeRenderers[i];
      this.queue.register(nr.kind, nr.createBatcher(renderer));
    }
  }

  public render(scene: SceneGraph, pass?: PassDescriptor): void {
    scene.updateWorldMatrices();
    this.cameraViewport = this.renderer.getCameraViewport();

    this.queue.clear();
    this.collect(scene.root);
    this.queue.sort();

    this.renderer.beginFrame(pass);
    this.queue.flush(this.renderer);
    this.renderer.endFrame();
  }

  private collect(node: Node): void {
    if (!node.visible) return;

    for (let i: number = 0; i < this.nodeRenderers.length; i++) {
      const nr: NodeRenderer = this.nodeRenderers[i];

      if (nr.matches(node)) {
        const command: DrawCommand | null = nr.collect(
          node,
          this.cameraViewport,
          this.worldBoundScratch,
        );

        if (command) {
          this.queue.submit(command);
        }

        break;
      }
    }

    const children: ReadonlyArray<Node> = node.getChildren();

    for (let i: number = 0; i < children.length; i++) {
      this.collect(children[i]);
    }
  }
}
