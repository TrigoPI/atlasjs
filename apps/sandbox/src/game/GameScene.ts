import { Scene, type SceneContext } from "@atlasjs/core";
import { INPUT, type Input } from "@atlasjs/input";
import { AssetManager, ASSETS, type Texture2D } from "@atlasjs/assets";
import { NEBULA_RENDERER, type NebulaRenderer } from "@atlasjs/nebula";

import { Player } from "./Player";

export class GameScene extends Scene {
  private player: Player;

  public constructor() {
    super("game-scene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const input: Input = ctx.services.get(INPUT);
    const assets: AssetManager = ctx.services.get(ASSETS);
    const renderer: NebulaRenderer = ctx.services.get(NEBULA_RENDERER);

    const playerTexture: Texture2D = await assets.loadTexture(
      "player",
      "assets/game/dinos/dino_blue.png",
    );

    const swordTexture: Texture2D = await assets.loadTexture(
      "sword",
      "assets/game/swords/Iicon_32_01.png",
    );

    this.player = new Player(input, renderer, playerTexture, swordTexture);
  }

  public override onUpdate(dt: number): void {
    this.player.onUpdate(dt);
  }
}
