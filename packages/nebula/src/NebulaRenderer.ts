import { CommandBuffer, Renderer, ViewState } from "@atlasjs/renderer";
import { Texture2D } from "@atlasjs/assets";

import { Camera2D } from "./camera";

import {
  Node,
  Overlay,
  RectNode,
  SceneGraph,
  SceneRenderer,
  SpriteNode,
} from "@atlasjs/scene";

export class NebulaRenderer {
  public readonly scene: SceneGraph;
  public readonly camera: Camera2D;
  public readonly root: Node;
  public readonly overlay: Overlay;

  private readonly cmds: CommandBuffer;
  private readonly sceneRenderer: SceneRenderer;

  private readonly renderer: Renderer;

  public constructor(renderer: Renderer) {
    this.renderer = renderer;

    this.overlay = new Overlay();
    this.scene = new SceneGraph();
    this.camera = new Camera2D();
    this.cmds = new CommandBuffer();

    this.root = this.scene.root;

    this.sceneRenderer = new SceneRenderer(
      this.scene,
      this.renderer,
      this.cmds,
      this.overlay,
    );
  }

  public createRect(id?: string): RectNode {
    return new RectNode(this.scene.dirty, id);
  }

  public createSprite(texture: Texture2D, id?: string): SpriteNode {
    return new SpriteNode(texture, this.scene.dirty, id);
  }

  public setViewportSize(w: number, h: number): void {
    this.camera.setViewportSize(w, h);
    this.renderer.resize(w, h);
  }

  public onFlush(): void {
    this.sceneRenderer.onFlush();
  }

  public onSync(): void {
    this.sceneRenderer.onSync();
  }

  public onRender(): void {
    const view: ViewState = this.camera.getViewState();
    this.sceneRenderer.onRender(view);
  }
}
