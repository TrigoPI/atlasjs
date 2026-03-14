import { Key, type Input } from "@atlasjs/input";
import type { Texture2D } from "@atlasjs/assets";
import { atan2, ObservalbeVec2, PI_4, Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer, SpriteNode } from "@atlasjs/nebula";

const PLAYER_SIZE: number = 24;
const HALF_PLAYER_SIZE: number = PLAYER_SIZE / 2;
const SPEED: number = 1000;

export class Player {
  private readonly input: Input;
  private readonly camera: Camera2D;

  private readonly player: SpriteNode;
  private readonly sword: SpriteNode;

  private readonly acc: Vec2;
  private readonly vel: Vec2;

  private readonly swordTexture: Texture2D;
  private readonly playerTexture: Texture2D;

  public constructor(
    input: Input,
    renderer: NebulaRenderer,
    playerTexture: Texture2D,
    swordTexture: Texture2D,
  ) {
    this.input = input;
    this.camera = renderer.camera;
    this.swordTexture = swordTexture;
    this.playerTexture = playerTexture;

    this.acc = new Vec2();
    this.vel = new Vec2();

    this.player = renderer
      .createSprite(this.playerTexture)
      .setSourceFrame(0, 0, PLAYER_SIZE, PLAYER_SIZE)
      .setScale(20, 20);

    console.log(this.player);

    this.sword = renderer
      .createSprite(this.swordTexture)
      .setScale(2, 2)
      .setAnchor(0, 1)
      .setPosition(0, 0);

    // this.player.add(this.sword);
    renderer.root.add(this.player);
  }

  public onUpdate(dt: number): void {
    this.resetPhysics();
    this.updateInput(dt);
    this.updatePhysics(dt);
    this.updatePosition();
    this.updateWallCollision();
    this.updateGunRotation();
  }

  private resetPhysics(): void {
    this.acc.set(0, 0);
  }

  private updateInput(dt: number) {
    if (this.input.isDown(Key.D)) {
      this.acc.x += SPEED * dt;
    }

    if (this.input.isDown(Key.A)) {
      this.acc.x -= SPEED * dt;
    }

    if (this.input.isDown(Key.W)) {
      this.acc.y -= SPEED * dt;
    }

    if (this.input.isDown(Key.S)) {
      this.acc.y += SPEED * dt;
    }
  }

  private updatePhysics(dt: number): void {
    this.vel.x += this.acc.x * dt;
    this.vel.y += this.acc.y * dt;
  }

  private updatePosition(): void {
    this.player.position.x += this.vel.x;
    this.player.position.y += this.vel.y;
  }

  private updateWallCollision(): void {
    const hs: number = PLAYER_SIZE / 2;
    const pScreen: Vec2 = this.camera.worldToScreen(this.player.position);
    const view: ObservalbeVec2 = this.camera.viewport;

    const offetLeft: Vec2 = new Vec2(HALF_PLAYER_SIZE, 0);
    const offsetRight: Vec2 = new Vec2(view.x - HALF_PLAYER_SIZE, 0);
    const offetTop: Vec2 = new Vec2(0, HALF_PLAYER_SIZE);
    const offetBottom: Vec2 = new Vec2(0, view.y - HALF_PLAYER_SIZE);

    if (pScreen.x - hs < 0) {
      const offset: Vec2 = this.camera.screenToWorld(offetLeft);
      this.player.position.x = offset.x;
      this.vel.x *= -1;
    }

    if (pScreen.x + hs > view.x) {
      const offset: Vec2 = this.camera.screenToWorld(offsetRight);
      this.player.position.x = offset.x;
      this.vel.x *= -1;
    }

    if (pScreen.y - hs < 0) {
      const offset: Vec2 = this.camera.screenToWorld(offetTop);
      this.player.position.y = offset.y;
      this.vel.y *= -1;
    }

    if (pScreen.y + hs > view.y) {
      const offset: Vec2 = this.camera.screenToWorld(offetBottom);
      this.player.position.y = offset.y;
      this.vel.y *= -1;
    }
  }

  private updateGunRotation(): void {
    const pWorld: Vec2 = this.camera.screenToWorld(this.input.pointer.position);
    const pLocal: Vec2 = this.player.worldToLocal(pWorld);
    const r: number = atan2(pLocal.y, pLocal.x) + PI_4;
    this.sword.setRotation(r);
  }
}
