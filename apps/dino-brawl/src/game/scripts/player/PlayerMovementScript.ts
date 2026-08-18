import { Vec2 } from "@atlasjs/math";
import type { DinoControls } from "../../controls";

import {
  AtlasScript,
  ButtonAction,
  CharacterController,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  Vector2Action,
} from "@atlasjs/gameplay";

export class PlayerMovementScript extends AtlasScript<{
  walkingSpeed: number;
  runningSpeed: number;
}> {
  private readonly walkingSpeed: number;
  private readonly runningSpeed: number;

  private character: CharacterController;

  private move: Vector2Action;
  private boost: ButtonAction;

  private readonly moveDelta: Vec2 = new Vec2();

  // prettier-ignore
  public onCreate(): void {
    const actions: PlayerInput<DinoControls> = this.requireComponent(PlayerInput);

    this.character = this.requireComponent(CharacterController);

    this.move = actions.get("move");
    this.boost = actions.get("boost");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    const vn: Vec2 = v.clone().normalize();

    const speed: number = this.boost.isDown()
      ? this.runningSpeed * 2
      : this.walkingSpeed;

    if (v.x !== 0 || v.y !== 0) {
      this.moveDelta.set(vn.x * speed * dt, vn.y * speed * dt);
      this.character.move(this.moveDelta);
    }
  }
}

registerScriptMetadata(PlayerMovementScript, {
  exposed: {
    walkingSpeed: ScriptMetadata.field({ required: true }),
    runningSpeed: ScriptMetadata.field({ required: true }),
  },
});
