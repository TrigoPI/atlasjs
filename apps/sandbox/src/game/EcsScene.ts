import BlueDino from "../../assets/game/dinos/dino_blue.png";
import Sword from "../../assets/game/swords/Iicon_32_10.png";

import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import { TestScript } from "./scripts/TestScript";
import { SwordScript } from "./scripts/SwordScript";

import {
  type CameraManager,
  type ScriptManager,
  Key,
  button,
  Camera,
  Sprite,
  vector2,
  CAMERA_MANAGER,
  defineActions,
  SCRIPT_MANAGER,
  SpriteAsset,
  Transform2D,
  SpriteRender,
} from "@atlasjs/gameplay";

import {
  type Texture2D,
  SpriteAnimation,
  SpriteSheet,
  TextureAsset,
} from "@atlasjs/nebula";

export class EcsScene extends Scene {
  public constructor() {
    super("game-scene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);
    const cameraManager: CameraManager = ctx.services.get(CAMERA_MANAGER);

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

    const cameraEntity: Entity = nexus.createEntity();
    const cameraComponent: Camera = nexus.addComponent(cameraEntity, Camera);

    nexus.addComponent(cameraEntity, Transform2D);
    cameraComponent.zoom = 1;

    const sword2: Entity = nexus.createEntity();
    nexus.addComponent(sword2, Transform2D);
    nexus.addComponent(sword2, SpriteRender, swordSprite);

    scriptManager.attach(sword, SwordScript, {
      sprite: swordSprite,
      scale: 1,
      maxPower: 200,
      orbitRadius: 10,
      throwDuration: 1,
      rotationSpeed: {
        max: 10 * Math.PI,
        min: Math.PI / 2,
      },
      orbitSpeed: {
        max: 6 * Math.PI,
        min: Math.PI,
      },
    });

    scriptManager.attach(player, TestScript, {
      clips,
      controls,
      sprite: blueDinoSprite,
      speed: 250,
      sword,
    });

    nexus.setParent(sword, player);
    nexus.setParent(cameraEntity, player);

    cameraManager.setActive(cameraEntity);
  }
}
