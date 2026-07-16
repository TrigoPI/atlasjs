import SwordImage from "../../assets/game/swords/Iicon_32_01.png";
import SeaLionImage from "../../assets/sealion.png";

import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";

import { TestScript } from "./scripts/TestScript";
import { WallScript } from "./scripts/WallScript";

import {
  type ScriptManager,
  SCRIPT_MANAGER,
  Sprite,
  SpriteRender,
  Transform2D,
} from "@atlasjs/gameplay";

import {
  type NebulaRenderer,
  type Texture2D,
  NEBULA_RENDERER,
} from "@atlasjs/nebula";

export class EcsScene extends Scene {
  public constructor() {
    super("game-scene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const nebula: NebulaRenderer = ctx.services.get(NEBULA_RENDERER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    const swordTexture: Texture2D = await this.loadTexture(nebula, SwordImage);
    const seaLionTexture: Texture2D = await this.loadTexture(
      nebula,
      SeaLionImage,
    );

    const swordSprite: Sprite = new Sprite(swordTexture);
    const seaLionSprite: Sprite = new Sprite(seaLionTexture);

    const player1: Entity = nexus.createEntity();
    const player2: Entity = nexus.createEntity();

    nexus.addComponent(player1, Transform2D);
    nexus.addComponent(player1, SpriteRender, swordSprite);

    nexus.addComponent(player2, Transform2D);
    nexus.addComponent(player2, SpriteRender, seaLionSprite);

    scriptManager.attach(player1, TestScript);
    scriptManager.attach(player2, WallScript);
  }

  private async loadTexture(
    nebula: NebulaRenderer,
    src: string,
  ): Promise<Texture2D> {
    const image: HTMLImageElement = new Image();
    image.src = src;
    await image.decode();

    const source: ImageBitmap = await createImageBitmap(image, {
      imageOrientation: "flipY",
    });

    return nebula.createTexture2D({
      source,
      width: source.width,
      height: source.height,
    });
  }
}
