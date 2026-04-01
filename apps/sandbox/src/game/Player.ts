import { type Input, Key } from "@atlasjs/input";
import { Vec2 } from "@atlasjs/math";

import type { Sword } from "./Sword";

import {
  type NebulaRenderer,
  type Sampler,
  type Texture2D,
  AnimationPlayer,
  Sprite,
  SpriteAnimation,
  SpriteSheet,
} from "@atlasjs/nebula";

const SPEED = 700;
const FRICTION = 0.05;

export class Player {
  private readonly input: Input;

  private readonly player: Sprite;
  private readonly animator: AnimationPlayer;

  private readonly sword: Sword;

  private readonly acc: Vec2;
  private readonly vel: Vec2;

  public constructor(
    input: Input,
    renderer: NebulaRenderer,
    texture: Texture2D,
    sampler: Sampler,
    sword: Sword,
  ) {
    this.input = input;
    this.sword = sword;

    this.player = new Sprite(texture, sampler);
    this.animator = new AnimationPlayer();

    this.acc = new Vec2(0, 0);
    this.vel = new Vec2(0, 0);

    this.player.setScale(3, 3).setPosition(100, 100);
    this.sword.attachTo(this.player);

    this.createAnimation(texture);

    renderer.scene.addChild(this.player);
  }

  public onUpdate(dt: number): void {
    this.resetPhysics();
    this.updateInput(dt);
    this.updatePhysics(dt);
    this.updatePosition();
    this.updateAnimation();

    this.animator.updateAndApply(this.player);
    this.sword.update(dt);
  }

  private resetPhysics(): void {
    this.acc.set(0, 0);
  }

  private updateInput(dt: number): void {
    if (this.input.isDown(Key.D)) {
      this.acc.x += SPEED * dt;
      this.player.flipX(false);
    }

    if (this.input.isDown(Key.A)) {
      this.acc.x -= SPEED * dt;
      this.player.flipX(true);
    }

    if (this.input.isDown(Key.W)) {
      this.acc.y -= SPEED * dt;
    }

    if (this.input.isDown(Key.S)) {
      this.acc.y += SPEED * dt;
    }
  }

  private updatePhysics(dt: number): void {
    const friction: Vec2 = this.vel.clone().mult(-FRICTION);
    this.vel.add(friction);

    this.vel.x += this.acc.x * dt;
    this.vel.y += this.acc.y * dt;
  }

  private updatePosition(): void {
    this.player.transform.position.x += this.vel.x;
    this.player.transform.position.y += this.vel.y;
  }

  private updateAnimation(): void {
    if (this.vel.mag() > 0.8) {
      this.animator.play("run");
    } else {
      this.animator.play("idle");
    }
  }

  private createAnimation(texture: Texture2D): void {
    const spriteSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "player",
      texture: texture,
      columns: 24,
      rows: 1,
    });

    const runAnimation: SpriteAnimation = new SpriteAnimation({
      fps: 11,
      loop: true,
      autoPlay: true,
      frames: spriteSheet.getManyInRange("player_", 4, 9),
    });

    const idleAnimation: SpriteAnimation = new SpriteAnimation({
      fps: 8,
      loop: true,
      autoPlay: true,
      frames: spriteSheet.getManyInRange("player_", 0, 3),
    });

    this.animator
      .add("run", runAnimation)
      .add("idle", idleAnimation)
      .setDefault("idle");
  }
}
