import { Bound } from "@atlasjs/math";

import { Renderer, SpriteBatch } from "../core";
import { SceneGraph } from "../scene";
import { Node, Sprite } from "../graphics";
import { RenderQueue } from "./RenderQueue";
import { SpriteRenderer } from "./SpriteRenderer";

export class SceneRenderer {
  private readonly renderer: Renderer;
  private readonly spriteRenderer: SpriteRenderer;
  private readonly queue: RenderQueue;
  private readonly batch: SpriteBatch;
  private readonly worldBoundScratch: Bound;

  private cameraViewport: Bound;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.spriteRenderer = new SpriteRenderer(renderer);
    this.queue = new RenderQueue();
    this.batch = renderer.createSpriteBatch();
    this.worldBoundScratch = new Bound();
    this.cameraViewport = new Bound();
  }

  public render(scene: SceneGraph): void {
    scene.updateWorldMatrices();
    this.cameraViewport = this.renderer.getCameraViewport();

    this.queue.clear();
    this.collect(scene.root);
    this.queue.sort();

    this.renderer.beginFrame();
    this.queue.flush(this.renderer, this.batch);
    this.renderer.endFrame();
  }

  private collect(node: Node): void {
    if (!node.visible) return;

    if (node instanceof Sprite && this.isSpriteVisible(node)) {
      this.queue.submit(this.spriteRenderer.buildCommand(node));
    }

    const children: ReadonlyArray<Node> = node.getChildren();

    for (let i: number = 0; i < children.length; i++) {
      this.collect(children[i]);
    }
  }

  private isSpriteVisible(sprite: Sprite): boolean {
    const spriteBounds: Bound = sprite.getWorldBound(this.worldBoundScratch);
    return this.cameraViewport.overlaps(spriteBounds);
  }
}
