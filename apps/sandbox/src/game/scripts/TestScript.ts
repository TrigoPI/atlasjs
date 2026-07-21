import { Vec2 } from "@atlasjs/math";

import {
  type ActionMapDescriptor,
  type ButtonActionSpec,
  type Vector2ActionSpec,
  Animator,
  AtlasScript,
  ButtonAction,
  PlayerInput,
  RigidBody,
  ScriptMetadata,
  Sprite,
  SpriteAnimation,
  SpriteRenderer,
  Transform,
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

  private transform: Transform;
  private rigidbody: RigidBody;
  private spriteRenderer: SpriteRenderer;
  private animator: Animator;

  private move: Vector2Action;
  private boost: ButtonAction;

  // prettier-ignore
  public onCreate(): void {
    const actions = this.addComponent(PlayerInput, this.controls);

    this.transform = this.addComponent(Transform);
    this.rigidbody = this.addComponent(RigidBody);

    this.spriteRenderer = this.addComponent(SpriteRenderer, this.sprite);
    this.animator = this.addComponent(Animator, this.clips, "idle");

    this.move = actions.get("move");
    this.boost = actions.get("boost");

    this.rigidbody.type = "kinematic";
    this.transform.setScale(3, 3)
    this.rigidbody.mass = 1;
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

registerScriptMetadata(TestScript, {
  exposed: {
    sprite: ScriptMetadata.field({ required: true }),
    clips: ScriptMetadata.field({ required: true }),
    speed: ScriptMetadata.field({ required: true }),
    controls: ScriptMetadata.field({ required: true }),
  },
});
