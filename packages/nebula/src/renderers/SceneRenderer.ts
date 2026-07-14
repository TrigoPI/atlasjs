import { Bound } from "@atlasjs/math";

import { PassDescriptor, Renderer, SpriteBatch, ShapeBatch } from "../core";
import { SceneGraph } from "../scene";
import { Node, Sprite, Shape } from "../graphics";
import { RenderQueue } from "./RenderQueue";
import { SpriteRenderer } from "./SpriteRenderer";
import { ShapeRenderer } from "./ShapeRenderer";
import { SpriteBatcher, ShapeBatcher } from "./Batchers";
import { ShapeDrawCommand } from "./DrawCommand";

export class SceneRenderer {
  private readonly renderer: Renderer;
  private readonly spriteRenderer: SpriteRenderer;
  private readonly shapeRenderer: ShapeRenderer;
  private readonly queue: RenderQueue;
  private readonly spriteBatcher: SpriteBatcher;
  private readonly shapeBatcher: ShapeBatcher;
  private readonly worldBoundScratch: Bound;

  private cameraViewport: Bound;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.spriteRenderer = new SpriteRenderer(renderer);
    this.shapeRenderer = new ShapeRenderer();
    this.queue = new RenderQueue();

    this.worldBoundScratch = new Bound();
    this.cameraViewport = new Bound();

    const spriteBatch: SpriteBatch = renderer.createSpriteBatch();
    const shapeBatch: ShapeBatch = renderer.createShapeBatch();
    this.spriteBatcher = new SpriteBatcher(spriteBatch);
    this.shapeBatcher = new ShapeBatcher(shapeBatch);
  }

  public render(scene: SceneGraph, pass?: PassDescriptor): void {
    scene.updateWorldMatrices();
    this.cameraViewport = this.renderer.getCameraViewport();

    this.queue.clear();
    this.collect(scene.root);
    this.queue.sort();

    this.renderer.beginFrame(pass);
    this.queue.flush(this.renderer, this.spriteBatcher, this.shapeBatcher);
    this.renderer.endFrame();
  }

  private collect(node: Node): void {
    if (!node.visible) return;

    if (node instanceof Sprite) {
      if (this.isSpriteVisible(node)) {
        this.queue.submit(this.spriteRenderer.buildCommand(node));
      }
    } else if (node instanceof Shape) {
      this.collectShape(node);
    }

    const children: ReadonlyArray<Node> = node.getChildren();

    for (let i: number = 0; i < children.length; i++) {
      this.collect(children[i]);
    }
  }

  private collectShape(shape: Shape): void {
    const command: ShapeDrawCommand | null =
      this.shapeRenderer.buildCommand(shape);

    if (!command) return;

    const bound: Bound = this.shapeRenderer.getWorldBound(
      command,
      this.worldBoundScratch,
    );

    if (this.cameraViewport.overlaps(bound)) {
      this.queue.submit(command);
    }
  }

  private isSpriteVisible(sprite: Sprite): boolean {
    const spriteBounds: Bound = sprite.getWorldBound(this.worldBoundScratch);
    return this.cameraViewport.overlaps(spriteBounds);
  }
}
