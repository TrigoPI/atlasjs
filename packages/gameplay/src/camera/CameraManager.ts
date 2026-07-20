import { Vec2 } from "@atlasjs/math";
import { NebulaRenderer } from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

export class CameraManager {
  private readonly renderer: NebulaRenderer;
  private active: Entity | undefined;

  public constructor(renderer: NebulaRenderer) {
    this.renderer = renderer;
    this.active = undefined;
  }

  public setActive(entity: Entity | undefined): void {
    this.active = entity;
  }

  public getActive(): Entity | undefined {
    return this.active;
  }

  public screenToWorld(screen: Vec2, out?: Vec2): Vec2 {
    return this.renderer.camera.screenToWorld(screen, out);
  }

  public worldToScreen(world: Vec2, out?: Vec2): Vec2 {
    return this.renderer.camera.worldToScreen(world, out);
  }
}
