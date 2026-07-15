import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  ButtonAction,
  Key,
  PlayerInput,
  RigidBody2DComponent,
  Transform2DComponent,
  Vector2Action,
  button,
  defineActions,
  vector2,
} from "@atlasjs/gameplay";

const controls = defineActions({
  move: vector2().wasd(),
  boost: button().keys(Key.Space),
});

export class TestScript extends AtlasScript {
  private transform!: Transform2DComponent;
  private rigidbody!: RigidBody2DComponent;
  private move!: Vector2Action;
  private boost!: ButtonAction;

  private readonly speed: number = 250;

  public onCreate(): void {
    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);

    this.rigidbody.type = "kinematic";

    this.transform.setScale(3, 3).setPosition(400, 300);

    const actions = this.addComponent(PlayerInput, controls);
    this.move = actions.get("move");
    this.boost = actions.get("boost");
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    const speed: number = this.boost.isDown() ? this.speed * 2 : this.speed;

    if (v.x !== 0 || v.y !== 0) {
      this.transform.translate(v.x * speed * dt, v.y * speed * dt);
    }
  }

  public onDestroy(): void {}
}
