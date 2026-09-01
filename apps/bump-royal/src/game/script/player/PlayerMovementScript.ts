import { Vec2 } from "@atlasjs/math";
import type { PlayerControls } from "@bump-royal/game/controls";

import {
  AtlasScript,
  PlayerInput,
  Vector2Action,
  CharacterController,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

type PlayerMovementScriptProps = {
  speed: number;
};

export class PlayerMovementScript extends AtlasScript<PlayerMovementScriptProps> {
  private readonly speed: number;

  private character: CharacterController;
  private controls: PlayerInput<PlayerControls>;

  private move: Vector2Action;
  private velocity: Vec2;

  public onCreate(): void {
    this.velocity = new Vec2();

    this.controls = this.requireComponent(PlayerInput);
    this.character = this.requireComponent(CharacterController);

    this.move = this.controls.get("move");
  }

  public onUpdate(dt: number): void {
    const acc: Vec2 = this.move
      .readValue()
      .clone()
      .normalize()
      .mult(this.speed * dt);

    this.velocity.add(acc).clamp(10);
    this.character.move(this.velocity);
  }
}

registerScriptMetadata(PlayerMovementScript, {
  exposed: {
    speed: ScriptMetadata.field({ required: true }),
  },
});
