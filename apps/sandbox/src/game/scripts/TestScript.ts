import { Vec2 } from "@atlasjs/math";

import {
  Animator,
  AtlasScript,
  ButtonAction,
  Key,
  PlayerInput,
  RigidBody2DComponent,
  SpriteRendererComponent,
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
  private readonly speed: number = 220;

  private transform!: Transform2DComponent;
  private rigidbody!: RigidBody2DComponent;
  private spriteRenderer!: SpriteRendererComponent;
  private animator!: Animator;

  private move!: Vector2Action;
  private boost!: ButtonAction;

  public onCreate(): void {
    const actions = this.addComponent(PlayerInput, controls);

    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);

    this.spriteRenderer = this.requireComponent(SpriteRendererComponent);
    this.animator = this.requireComponent(Animator);

    this.move = actions.get("move");
    this.boost = actions.get("boost");

    this.rigidbody.type = "kinematic";
    this.transform.setScale(3, 3).setPosition(400, 300);
    this.rigidbody.setMass(1);
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    const speed: number = this.boost.isDown() ? this.speed * 2 : this.speed;

    if (v.x !== 0 || v.y !== 0) {
      this.animator.play("run");
      this.transform.translate(v.x * speed * dt, v.y * speed * dt);
      this.spriteRenderer.flipX = v.x < 0;
    } else {
      this.animator.play("idle");
    }
  }

  public onDestroy(): void {}
}
