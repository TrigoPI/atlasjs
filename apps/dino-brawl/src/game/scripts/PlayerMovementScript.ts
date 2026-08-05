import { Vec2 } from "@atlasjs/math";
import type { GameEntity } from "@atlasjs/gameplay";
import type { DinoControls } from "../controls";

import {
  AtlasScript,
  ButtonAction,
  CharacterController,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  Vector2Action,
} from "@atlasjs/gameplay";

export class PlayerMovementScript extends AtlasScript<{ speed: number }> {
  private readonly speed: number;

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
    const speed: number = this.boost.isDown() ? this.speed * 2 : this.speed;

    if (v.x !== 0 || v.y !== 0) {
      this.moveDelta.set(v.x * speed * dt, v.y * speed * dt);
      this.character.move(this.moveDelta);
    }
  }

  public onCollisionEnter(other: GameEntity): void {
    console.log("[collision] player entered", other.id);
  }
}

registerScriptMetadata(PlayerMovementScript, {
  exposed: {
    speed: ScriptMetadata.field({ required: true }),
  },
});
