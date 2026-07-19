import BlueDino from "../../assets/game/dinos/dino_blue.png";
import Sword from "../../assets/game/swords/Iicon_32_01.png";

import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import { TestScript } from "./scripts/TestScript";

import {
  type ScriptManager,
  button,
  defineActions,
  Key,
  SCRIPT_MANAGER,
  Sprite,
  SpriteAsset,
  vector2,
} from "@atlasjs/gameplay";

import {
  type Texture2D,
  SpriteAnimation,
  SpriteSheet,
  TextureAsset,
} from "@atlasjs/nebula";
import { SwordScript } from "./scripts/SwordScript";

export class EcsScene extends Scene {
  public constructor() {
    super("game-scene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    const dinoAsset: TextureAsset = new TextureAsset(BlueDino);
    const blueDinoTexture: Texture2D = await assets.load<Texture2D>(dinoAsset);

    const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset);
    const blueDinoSprite: Sprite = await assets.load<Sprite>(dinoSpriteAsset);

    const swordSpriteAsset: SpriteAsset = SpriteAsset.fromPath(Sword);
    const swordSprite: Sprite = await assets.load<Sprite>(swordSpriteAsset);

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

    const player: Entity = nexus.createEntity();
    const sword: Entity = nexus.createEntity();

    nexus.setParent(sword, player);

    scriptManager.attach(sword, SwordScript, {
      sprite: swordSprite,
      scale: 0.7,
    });

    scriptManager.attach(player, TestScript, {
      clips,
      controls,
      sprite: blueDinoSprite,
      speed: 250,
    });
  }
}
