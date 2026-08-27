import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";

import {
  AtlasScript,
  AudioApi,
  CharacterController,
  PlayerInput,
  registerScriptMetadata,
  ScriptMetadata,
  SpriteRenderer,
  type AfterimageRenderer,
  type ButtonAction,
  type Countdown,
  type Stopwatch,
  type Vector2Action,
} from "@atlasjs/gameplay";

import type { DinoControls } from "../../controls";

import type { HurtboxScript } from "../combat/HurtboxScript";

type PlayerDashScriptProps = {
  distance?: number;
  duration?: number;
  cooldown?: number;
  afterimages?: AfterimageRenderer;
  woosh?: AudioClip;
  hurtbox?: HurtboxScript;
};

export class PlayerDashScript extends AtlasScript<PlayerDashScriptProps> {
  private readonly distance: number = 220;
  private readonly duration: number = 0.18;
  private readonly cooldown: number = 0.6;
  private readonly afterimages?: AfterimageRenderer;
  private readonly woosh?: AudioClip;
  private readonly hurtbox?: HurtboxScript;

  private readonly wooshPitch: number = 1;
  private readonly wooshPitchJitter: number = 0.08;
  private readonly wooshVolume: number = 1;

  private readonly direction: Vec2 = new Vec2(1, 0);
  private readonly moveDelta: Vec2 = new Vec2();

  private character: CharacterController;
  private sprite: SpriteRenderer;
  private audio?: AudioApi;

  private dash: ButtonAction;
  private move: Vector2Action;

  private dashing: boolean = false;
  private completed: boolean = false;
  private travelled: number = 0;

  private dashClock: Stopwatch;
  private cooldownTimer: Countdown;

  private get progress(): number {
    return Math.min(1, this.dashClock.elapsed / this.duration);
  }

  public get isDashing(): boolean {
    return this.dashing;
  }

  /** The direction locked in at the trigger. Live reference, never copied. */
  public get dashDirection(): Vec2 {
    return this.direction;
  }

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> =
      this.requireComponent(PlayerInput);

    this.character = this.requireComponent(CharacterController);
    this.sprite = this.requireComponent(SpriteRenderer);
    this.audio = this.getService(AudioApi);

    this.dash = actions.get("dash");
    this.move = actions.get("move");

    this.dashing = false;
    this.completed = false;
    this.travelled = 0;

    this.dashClock = this.stopwatch();
    this.cooldownTimer = this.countdown(0);

    if (this.afterimages !== undefined) {
      this.afterimages.emitting = false;
    }
  }

  public onUpdate(): void {
    if (this.dashing && this.completed) {
      this.stop();
    }

    if (this.canStart()) {
      this.start();
    }

    if (this.dashing) {
      this.advance();
    }
  }

  public onDestroy(): void {
    if (this.afterimages !== undefined) {
      this.afterimages.emitting = false;
    }
  }

  private canStart(): boolean {
    return this.dash.isPressed() && !this.dashing && this.cooldownTimer.done;
  }

  private start(): void {
    this.captureDirection();

    this.dashing = true;
    this.completed = false;
    this.travelled = 0;

    this.dashClock.reset();
    this.cooldownTimer.reset(this.cooldown);

    if (this.afterimages !== undefined) {
      this.afterimages.emitting = true;
    }

    if (this.hurtbox !== undefined) {
      this.hurtbox.grantInvincibility(this.duration);
    }

    this.playWoosh();
  }

  private stop(): void {
    this.dashing = false;

    if (this.afterimages !== undefined) {
      this.afterimages.emitting = false;
    }
  }

  /** Frozen at the trigger: a move input changing mid-dash cannot bend it. */
  private captureDirection(): void {
    const v: Vec2 = this.move.readValue();

    if (v.x !== 0 || v.y !== 0) {
      this.direction.copyFrom(v).normalize();
      return;
    }

    this.direction.set(this.sprite.flipX ? -1 : 1, 0);
  }

  /** Steps by the gap between this frame's covered distance and the last. */
  private advance(): void {
    const progress: number = this.progress;
    const covered: number = this.distance * this.curveAt(progress);
    const step: number = covered - this.travelled;

    this.travelled = covered;
    this.completed = progress >= 1;

    if (step === 0) {
      return;
    }

    this.moveDelta.copyFrom(this.direction).mult(step);
    this.character.move(this.moveDelta);
  }

  /** Fraction of the distance covered at a normalized time. Linear today. */
  private curveAt(progress: number): number {
    return progress;
  }

  private playWoosh(): void {
    if (this.audio === undefined || this.woosh === undefined) {
      return;
    }

    const jitter: number = (Math.random() * 2 - 1) * this.wooshPitchJitter;

    this.audio.playOneShot(this.woosh, {
      pitch: Math.max(0.01, this.wooshPitch + jitter),
      volume: this.wooshVolume,
    });
  }
}

registerScriptMetadata(PlayerDashScript, {
  exposed: {
    distance: ScriptMetadata.field(),
    duration: ScriptMetadata.field(),
    cooldown: ScriptMetadata.field(),
    afterimages: ScriptMetadata.field(),
    woosh: ScriptMetadata.field(),
    hurtbox: ScriptMetadata.field(),
  },
});
