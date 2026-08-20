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
  public update({ world, dt }: NexusSystemContext): void {
    this.manager.advanceShake(dt);

    const active: Entity | undefined = this.manager.getActive();
    if (active === undefined) return;

    const wt: WorldTransform2D | undefined = world.getComponent(active, WorldTransform2D);
    const cam: Camera | undefined = world.getComponent(active, Camera);

    if (wt === undefined || cam === undefined) return;

    const center: Vec2 = wt.getPosition(this.centerScratch);
    const camera: Camera2D = this.renderer.camera;

    camera.zoom = cam.zoom;
    const viewport: Bound = this.renderer.getCameraViewport();

    const shake: Vec2 = this.manager.getShakeOffset();

    camera.position.set(
      center.x - viewport.width / 2 + shake.x,
      center.y - viewport.height / 2 + shake.y,
    );
  }
}
