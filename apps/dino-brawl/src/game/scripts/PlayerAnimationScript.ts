import type { Vec2 } from "@atlasjs/math";

import {
  Animator,
  AtlasScript,
  ButtonAction,
  PlayerInput,
  SpriteRenderer,
  Vector2Action,
} from "@atlasjs/gameplay";

import type { DinoControls } from "../controls";

export class PlayerAnimationScript extends AtlasScript {
  private animator: Animator;
  private spriteRenderer: SpriteRenderer;

  private move: Vector2Action;
  private boost: ButtonAction;
  private clock: number;

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> =
      this.requireComponent(PlayerInput);

    this.animator = this.requireComponent(Animator);
    this.spriteRenderer = this.requireComponent(SpriteRenderer);

    this.move = actions.get("move");
    this.boost = actions.get("boost");

    this.clock = 0;
  }

  public onUpdate(dt: number): void {
    this.clock += dt;

    const v: Vec2 = this.move.readValue();

    if (v.x !== 0 || v.y !== 0) {
      const animation: string = this.boost.isDown() ? "sprint" : "run";
      this.animator.play(animation);
    } else {
      this.clock = 0;
      this.animator.play("idle");
    }

    if (this.boost.isDown() && v.mag() === 0) {
      this.animator.play("pre_sprint");
    }

    if (v.x !== 0) {
      this.spriteRenderer.flipX = v.x < 0;
    }
  }
}
