import type { Vec2 } from "@atlasjs/math";
import type { GameEntity } from "@atlasjs/gameplay";

import {
  type ButtonActionSpec,
  type Vector2ActionSpec,
  AtlasScript,
  ButtonAction,
  PlayerInput,
  registerScriptMetadata,
  RigidBody,
  ScriptMetadata,
  Transform,
  Vector2Action,
} from "@atlasjs/gameplay";

type Inputs = {
  move: Vector2ActionSpec;
  boost: ButtonActionSpec;
  hello: ButtonActionSpec;
};

export class PlayerMovementScript extends AtlasScript<{
  speed: number;
}> {
  private readonly speed: number;

  private transform: Transform;
  private rigidbody: RigidBody;

  private move: Vector2Action;
  private boost: ButtonAction;

  // prettier-ignore
  public onCreate(): void {
    const actions: PlayerInput<Inputs> = this.requireComponent(PlayerInput);

    this.transform = this.requireComponent(Transform);
    this.rigidbody = this.requireComponent(RigidBody);

    this.move = actions.get("move");
    this.boost = actions.get("boost");

    this.rigidbody.type = "kinematic";
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    const speed: number = this.boost.isDown() ? this.speed * 2 : this.speed;

    if (v.x !== 0 || v.y !== 0) {
      this.transform.translate(v.x * speed * dt, v.y * speed * dt);
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
