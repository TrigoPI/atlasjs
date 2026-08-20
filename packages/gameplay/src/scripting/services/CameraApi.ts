import { Vec2 } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";

import { CameraManager, CAMERA_MANAGER } from "../../camera";

import { ScriptService } from "../core";

export class CameraApi extends ScriptService<CameraManager> {
  public static readonly token = CAMERA_MANAGER;

  public screenToWorld(screen: Vec2, out?: Vec2): Vec2 {
    return this.provided.screenToWorld(screen, out);
  }

  public worldToScreen(world: Vec2, out?: Vec2): Vec2 {
    return this.provided.worldToScreen(world, out);
  }

  public setMain(entity: Entity): void {
    this.provided.setActive(entity);
  }

  /** Kicks the camera off-centre along `direction`; a spring pulls it back. */
  public shake(strength: number, direction?: Vec2): void {
    this.provided.shake(strength, direction);
  }
}
