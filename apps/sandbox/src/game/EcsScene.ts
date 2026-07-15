import SwordImage from "../../assets/game/swords/Iicon_32_01.png";
import SeaLionImage from "../../assets/sealion.png";

import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { TestScript } from "./scripts/TestScript";

import {
  ScriptManager,
  SCRIPT_MANAGER,
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

    const swordImage: ImageBitmap = await this.getImage(SwordImage);
    const swordTexture: Texture2D = nebula.createTexture2D({
      source: swordImage,
      height: swordImage.height,
      width: swordImage.width,
    });

    const seaLionImage: ImageBitmap = await this.getImage(SeaLionImage);
    const seaLionTexture: Texture2D = nebula.createTexture2D({
      source: seaLionImage,
      height: seaLionImage.height,
      width: seaLionImage.width,
    });

    const player1: Entity = nexus.createEntity();
    const player2: Entity = nexus.createEntity();

    nexus.addComponent(player1, SpriteRender, swordTexture);

    nexus.addComponent(player2, SpriteRender, seaLionTexture);
    nexus.addComponent(player2, Transform2D);

    scriptManager.attach(player1, TestScript);
    // scriptManager.attach(player2, TestScript);
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
