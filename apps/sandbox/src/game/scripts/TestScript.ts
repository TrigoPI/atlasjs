import { Vec2 } from "@atlasjs/math";

import {
  type ActionMapDescriptor,
  type ButtonActionSpec,
  type Vector2ActionSpec,
  Animator,
  AtlasScript,
  ButtonAction,
  PlayerInput,
  RigidBody2DComponent,
  Sprite,
  SpriteAnimation,
  SpriteRendererComponent,
  Transform2DComponent,
  Vector2Action,
  registerScriptMetadata,
} from "@atlasjs/gameplay";

type PlayerControlsDescriptor = ActionMapDescriptor<{
  move: Vector2ActionSpec;
  boost: ButtonActionSpec;
  hello: ButtonActionSpec;
}>;

export class TestScript extends AtlasScript<{
  sprite: Sprite;
  speed: number;
  controls: PlayerControlsDescriptor;
  clips: Record<string, SpriteAnimation>;
}> {
  private readonly sprite: Sprite;
  private readonly clips: Record<string, SpriteAnimation>;
  private readonly speed: number;
  private readonly controls: PlayerControlsDescriptor;

  private transform: Transform2DComponent;
  private rigidbody: RigidBody2DComponent;
  private spriteRenderer: SpriteRendererComponent;
  private animator: Animator;

  private move: Vector2Action;
  private boost: ButtonAction;
  private hello: ButtonAction;

  // prettier-ignore
  public onCreate(): void {
    const actions = this.addComponent(PlayerInput, this.controls);

    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);

    this.spriteRenderer = this.addComponent(SpriteRendererComponent, this.sprite);
    this.animator = this.addComponent(Animator, this.clips, "idle");

    this.move = actions.get("move");
    this.boost = actions.get("boost");
    this.hello = actions.get("hello");

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

    if (this.hello.isPressed()) {
      console.log("Hello action triggered");
    }
  }

  public onDestroy(): void {}
}

registerScriptMetadata(TestScript, {
  exposed: {
    sprite: { required: true },
    clips: { required: true },
    speed: { required: true },
    controls: { required: true },
  },
});
