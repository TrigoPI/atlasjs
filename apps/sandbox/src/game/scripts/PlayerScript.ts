import { Vec2 } from "@atlasjs/math";

import {
  type ButtonActionSpec,
  type Vector2ActionSpec,
  Animator,
  AtlasScript,
  PlayerInput,
  SpriteRenderer,
  Transform,
  Vector2Action,
  registerScriptMetadata,
} from "@atlasjs/gameplay";

type Inputs = {
  move: Vector2ActionSpec;
  boost: ButtonActionSpec;
  hello: ButtonActionSpec;
};

export class PlayerScript extends AtlasScript {
  private transform: Transform;
  private animator: Animator;
  private spriteRenderer: SpriteRenderer;

  private move: Vector2Action;

  // prettier-ignore
  public onCreate(): void {
    const actions: PlayerInput<Inputs> = this.requireComponent(PlayerInput);

    this.transform = this.requireComponent(Transform);
    this.animator = this.requireComponent(Animator);
    this.spriteRenderer = this.requireComponent(SpriteRenderer);

    this.move = actions.get("move");

    this.transform.setScale(3, 3);
    this.transform.setPosition(800, 600);
    this.spriteRenderer.sortingOrder = 10;
  }

  public onUpdate(): void {
    const v: Vec2 = this.move.readValue();

    if (v.x !== 0 || v.y !== 0) {
      this.animator.play("run");
      this.spriteRenderer.flipX = v.x < 0;
    } else {
      this.animator.play("idle");
    }
  }
}

registerScriptMetadata(PlayerScript, {
  exposed: {},
});
