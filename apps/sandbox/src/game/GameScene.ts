import BlueDinoImage from "../../assets/game/dinos/dino_blue.png";
import SwordImage from "../../assets/game/swords/Iicon_32_01.png";

import { type PhysicsWorld, INERTIAL_ENGINE } from "@atlasjs/inertia";
import { type SceneContext, Scene } from "@atlasjs/core";
import { type Input, INPUT } from "@atlasjs/input";
import { Vec2 } from "@atlasjs/math";

import { Player } from "./Player";
import { Sword } from "./Sword";

import {
  type NebulaRenderer,
  type Sampler,
  type Texture2D,
  NEBULA_RENDERER,
} from "@atlasjs/nebula";

export class GameScene extends Scene {
  private player: Player;
  private sword: Sword;

  public constructor() {
    super("game-scene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const input: Input = ctx.services.get(INPUT);
    const renderer: NebulaRenderer = ctx.services.get(NEBULA_RENDERER);
    const physics: PhysicsWorld = ctx.services.get(INERTIAL_ENGINE);

    const dinoImage: ImageBitmap = await this.getImage(BlueDinoImage);
    const swordImage: ImageBitmap = await this.getImage(SwordImage);

    const sampler: Sampler = renderer.createSampler({
      minFilter: "nearest",
      magFilter: "nearest",
    });

    const swordTexture: Texture2D = renderer.createTexture2D({
      source: swordImage,
      height: swordImage.height,
      width: swordImage.width,
    });

    const playerTexture: Texture2D = renderer.createTexture2D({
      source: dinoImage,
      height: dinoImage.height,
      width: dinoImage.width,
    });

    physics.createCollider({
      shape: { type: "box", height: 100, width: 1000 },
      translation: new Vec2(0, 200),
      friction: 0.05,
    });

    this.sword = new Sword(swordTexture, sampler, input, renderer);
    this.player = new Player(
      input,
      renderer,
      physics,
      playerTexture,
      sampler,
      this.sword,
    );
  }

  public override onUpdate(dt: number): void {
    this.player.onUpdate(dt);
  }

  private async getImage(src: string): Promise<ImageBitmap> {
    const image: HTMLImageElement = new Image();
    image.src = src;
    await image.decode();
    return createImageBitmap(image, {
      imageOrientation: "flipY",
    });
  }
}
