import BlueDino from "../../assets/game/dinos/dino_blue.png";

import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";

import { TestScript } from "./scripts/TestScript";

import {
  type ScriptManager,
  button,
  defineActions,
  Key,
  SCRIPT_MANAGER,
  Sprite,
  vector2,
} from "@atlasjs/gameplay";

import {
  type NebulaRenderer,
  type Texture2D,
  NEBULA_RENDERER,
  SpriteAnimation,
  SpriteSheet,
} from "@atlasjs/nebula";

export class EcsScene extends Scene {
  public constructor() {
    super("game-scene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const nebula: NebulaRenderer = ctx.services.get(NEBULA_RENDERER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    const blueDinoTexture: Texture2D = await this.loadTexture(nebula, BlueDino);
    const blueDinoSprite: Sprite = new Sprite(blueDinoTexture);

    const sheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "blue_dino",
      texture: blueDinoTexture,
      rows: 1,
      columns: 24,
    });

    const controls = defineActions({
      move: vector2().wasd(),
      boost: button().keys(Key.Space),
      hello: button().keys(Key.MouseLeft),
    });

    const clips: Record<string, SpriteAnimation> = {
      idle: new SpriteAnimation({
        frames: sheet.getManyInRange("blue_dino_", 0, 3),
        fps: 5,
        loop: true,
        autoPlay: true,
      }),
      run: new SpriteAnimation({
        frames: sheet.getManyInRange("blue_dino_", 4, 9),
        fps: 12,
        loop: true,
        autoPlay: true,
      }),
    };

    const player1: Entity = nexus.createEntity();

    scriptManager.attach(player1, TestScript, {
      clips,
      controls,
      sprite: blueDinoSprite,
      speed: 250,
    });
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
