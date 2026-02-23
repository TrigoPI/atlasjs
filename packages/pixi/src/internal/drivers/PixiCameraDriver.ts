import { ICameraDriver, ViewParams } from "@atlasjs/render/backend";
import { Container } from "pixi.js";

export class PixiCameraDriver implements ICameraDriver {
  private readonly worldRoot: Container;

  public constructor(worldRoot: Container) {
    this.worldRoot = worldRoot;
  }

  public setView({ position, rotation, viewport, zoom }: ViewParams): void {
    this.worldRoot.pivot.set(position.x, position.y);
    this.worldRoot.position.set(viewport.width * 0.5, viewport.height * 0.5);
    this.worldRoot.scale.set(zoom, zoom);
    this.worldRoot.rotation = rotation;
  }
}
