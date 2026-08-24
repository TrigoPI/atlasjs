import type { Vec2 } from "@atlasjs/math";

import {
  Animator,
  AtlasScript,
  ButtonAction,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  SpriteRenderer,
  Vector2Action,
} from "@atlasjs/gameplay";

import type { DinoControls } from "../../controls";

import type { PlayerDashScript } from "./PlayerDashScript";

export class PlayerAnimationScript extends AtlasScript<{
  dash: PlayerDashScript;
}> {
  private readonly dash: PlayerDashScript;

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
    if (this.dash.isDashing) {
      this.playDash();
      return;
    }

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

  /** Faces the locked dash direction, not the move input, which may differ. */
  private playDash(): void {
    this.animator.play("dash");

    const direction: Vec2 = this.dash.dashDirection;

    if (direction.x !== 0) {
      this.spriteRenderer.flipX = direction.x < 0;
    }
  }
}

registerScriptMetadata(PlayerAnimationScript, {
  exposed: {
    dash: ScriptMetadata.field({ required: true }),
  },
});
