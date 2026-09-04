import { type SceneContext, Scene } from "@atlasjs/core";

import { spawnArena, spawnCamera, spawnPlayer } from "./spawn";
import { ASSET_MANAGER, type AssetManager } from "@atlasjs/assets";
import { AssetsLoader, AudioList, SpriteList, type AssetName } from "./loaders";
import { Vec2 } from "@atlasjs/math";

import { PlayerControls } from "./controls";
import { Color } from "@atlasjs/nebula";

export class MainScene extends Scene {
  private fpsCallback: (fps: number) => void;
  private onReady: () => void;

  public constructor(cb: (fps: number) => void, onReady: () => void) {
    super("main-scene");
    this.fpsCallback = cb;
    this.onReady = onReady;
  }

  // prettier-ignore
  public override async onCreate(ctx: SceneContext): Promise<void> {
    const asset: AssetManager = ctx.services.get(ASSET_MANAGER);
    const assetsLoader: AssetsLoader<AssetName> = new AssetsLoader(asset);

    await this.loadAssets(assetsLoader);

    spawnCamera(ctx);
    spawnArena(ctx, assetsLoader);

    spawnPlayer(ctx, assetsLoader, {
      position:  Vec2.create(0, 0),
      controls: PlayerControls.Player1,
      color: Color.White(),
    });

    spawnPlayer(ctx, assetsLoader, {
      position:  Vec2.create(0, 100),
      controls: PlayerControls.Player2,
      color: Color.Blue(),
    });

    this.onReady();
  }

  public onUpdate(dt: number): void {
    this.fpsCallback(1 / dt);
  }

  private async loadAssets(
    assetsLoader: AssetsLoader<AssetName>,
  ): Promise<void> {
    this.initAssets(assetsLoader);
    await assetsLoader.load();
  }

  private initAssets(assetLoader: AssetsLoader<AssetName>): void {
    for (const asset of SpriteList) {
      assetLoader.addSprite(asset.name, asset.path);
    }

    for (const audio of AudioList) {
      assetLoader.addAudio(audio.name, audio.path);
    }
  }
}
