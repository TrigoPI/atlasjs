import { Vec2 } from "@atlasjs/math";

import {
  type ButtonActionSpec,
  type GameEntity,
  type Vector2ActionSpec,
  Animator,
  AtlasScript,
  ButtonAction,
  Color,
  PlayerInput,
  ScriptMetadata,
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

export class PlayerScript extends AtlasScript<{
  spawn: Vec2;
  shadow: GameEntity;
}> {
  private readonly spawn: Vec2;
  private readonly shadow: GameEntity;

  private transform: Transform;
  private animator: Animator;
  private spriteRenderer: SpriteRenderer;

  private move: Vector2Action;
  private boost: ButtonAction;

  // prettier-ignore
  public onCreate(): void {
    const actions: PlayerInput<Inputs> = this.requireComponent(PlayerInput);
  
    const spriteRendererShadow: SpriteRenderer = this.shadow.requireComponent(SpriteRenderer);
    const transformShadow: Transform = this.shadow.requireComponent(Transform);

    this.transform = this.requireComponent(Transform);
    this.animator = this.requireComponent(Animator);
    this.spriteRenderer = this.requireComponent(SpriteRenderer);

    this.move = actions.get("move");
    this.boost = actions.get("boost");

    this.transform.setScale(3, 3);
    this.transform.position.copyFrom(this.spawn);
    this.spriteRenderer.sortingOrder = 10;

    spriteRendererShadow.sortingOrder = 8;
    spriteRendererShadow.color = new Color(1, 1, 1, 0.4);

    transformShadow.setScale(0.7, 0.6);
    transformShadow.setPosition(-0.5, -3);
  }

  public onUpdate(): void {
    const v: Vec2 = this.move.readValue();

    if (v.x !== 0 || v.y !== 0) {
      const animation: string = this.boost.isDown() ? "sprint" : "run";
      this.animator.play(animation);
    } else {
      this.animator.play("idle");
    }

    if (v.x !== 0) {
      this.spriteRenderer.flipX = v.x < 0;
    }
  }
}

registerScriptMetadata(PlayerScript, {
  exposed: {
    shadow: ScriptMetadata.entity({ required: true }),
    spawn: ScriptMetadata.field({ required: true }),
  },
});
