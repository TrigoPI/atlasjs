import { Bound, Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer } from "@atlasjs/nebula";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { CameraManager } from "../camera";
import { Camera, WorldTransform2D } from "../components";

export class CameraSyncSystem implements NexusSystem {
  private readonly manager: CameraManager;
  private readonly renderer: NebulaRenderer;
  private readonly centerScratch: Vec2;

  public constructor(manager: CameraManager, renderer: NebulaRenderer) {
    this.manager = manager;
    this.renderer = renderer;
    this.centerScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const active: Entity | undefined = this.manager.getActive();
    if (active === undefined) return;

    const wt: WorldTransform2D | undefined = world.getComponent(active, WorldTransform2D);
    const cam: Camera | undefined = world.getComponent(active, Camera);

    if (wt === undefined || cam === undefined) return;

    const center: Vec2 = wt.getPosition(this.centerScratch);
    const camera: Camera2D = this.renderer.camera;
    const viewport: Bound = this.renderer.getCameraViewport();

    camera.zoom = cam.zoom;
    
    camera.position.set(
      center.x - viewport.width / 2,
      center.y - viewport.height / 2,
    );
  }
}
