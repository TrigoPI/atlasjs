import { Vec2 } from "@atlasjs/math";
import { type Input, Key } from "@atlasjs/input";

import type { Sword } from "./Sword";

import {
  type Collider,
  type ColliderDesc,
  type PhysicsWorld,
  type RigidBody,
} from "@atlasjs/inertia";

import {
  type NebulaRenderer,
  type Sampler,
  type Texture2D,
  AnimationPlayer,
  Sprite,
  SpriteAnimation,
  SpriteSheet,
} from "@atlasjs/nebula";

const SPEED = 200;

export class Player {
  private readonly input: Input;

  private readonly player: Sprite;
  private readonly animator: AnimationPlayer;

  private readonly body: RigidBody;
  private readonly collider: Collider;

  private readonly sword: Sword;

  public constructor(
    input: Input,
    renderer: NebulaRenderer,
    physics: PhysicsWorld,
    texture: Texture2D,
    sampler: Sampler,
    sword: Sword,
  ) {
    const shape: ColliderDesc = {
      shape: {
        type: "box",
        height: 100,
        width: 100,
      },
    };

    this.input = input;
    this.sword = sword;

    this.player = new Sprite(texture, sampler);
    this.animator = new AnimationPlayer();

    this.body = physics.createRigidBody({ type: "dynamic" });

    this.collider = physics.createCollider(shape, this.body);

    this.player.setScale(3, 3).setPosition(100, 100);
    this.sword.attachTo(this.player);

    this.createAnimation(texture);

    renderer.scene.addChild(this.player);
  }

  public onUpdate(dt: number): void {
    this.updateInput();
    this.updatePosition();
    this.updateAnimation();

    this.animator.updateAndApply(this.player, dt * 1000);
    this.sword.update(dt);
  }

  private updateInput(): void {
    if (this.input.isDown(Key.D)) {
      this.body.setLinearVelocity(SPEED, 0);
      this.player.flipX(false);
    }

    if (this.input.isDown(Key.A)) {
      this.body.setLinearVelocity(-SPEED, 0);
      this.player.flipX(true);
    }
  }

  private updatePosition(): void {
    const bodyPos: Vec2 = this.body.getTranslation();
    const rotation: number = this.body.getRotation();
    this.player.transform.position.copyFrom(bodyPos);
    this.player.transform.rotation = rotation;
  }

  private updateAnimation(): void {
    if (this.body.getLinearVelocity().mag() > 100) {
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
