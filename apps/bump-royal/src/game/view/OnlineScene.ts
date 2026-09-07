import { Scene, type SceneContext } from "@atlasjs/core";
import { ASSET_MANAGER, type AssetManager } from "@atlasjs/assets";
import {
  INSTANTIATOR,
  SCRIPT_MANAGER,
  type Instantiator,
  type ScriptManager,
} from "@atlasjs/gameplay";
import { NEXUS, type Entity, type NexusWorld } from "@atlasjs/nexus";

import { registerApplyNetState } from "../../client/applyNetState";
import { nowSeconds } from "../../client/clock";
import { createNetPlayerFactory } from "../../client/netPlayerFactory";
import { registerNetEvents } from "../../client/netEvents";
import { NetworkClient } from "../../client/NetworkClient";
import { registerSendInput } from "../../client/sendInput";
import { registerLocalIntent } from "../sim/localIntent";
import { PlayerControls } from "../sim/controls";

import { AssetsLoader, AudioList, SpriteList, type AssetName } from "./loaders";
import { spawnArena, spawnCamera, spawnLocalInput } from "./spawn";

export class OnlineScene extends Scene {
  private readonly fpsCallback: (fps: number) => void;
  private readonly onReady: () => void;
  private readonly serverUrl: string;

  private client: NetworkClient | null;
  private onVisibilityChange: (() => void) | null;

  public constructor(
    cb: (fps: number) => void,
    onReady: () => void,
    serverUrl: string,
  ) {
    super("online-scene");
    this.fpsCallback = cb;
    this.onReady = onReady;
    this.serverUrl = serverUrl;
    this.client = null;
    this.onVisibilityChange = null;
  }

  /* No local player is spawned: every disc on screen, the one this tab drives included, comes
     back from the server through NetworkClient. */
  public override async onCreate(ctx: SceneContext): Promise<void> {
    const asset: AssetManager = ctx.services.get(ASSET_MANAGER);
    const assetsLoader: AssetsLoader<AssetName> = new AssetsLoader(asset);
    const world: NexusWorld = ctx.services.get(NEXUS);
    const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);
    const scripts: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    await this.loadAssets(assetsLoader);

    registerLocalIntent(ctx.scheduler, world);

    spawnCamera(ctx);
    spawnArena(ctx, assetsLoader);

    /* Both tabs bind Player1: the server, not the keyboard, decides who is who. */
    const input: Entity = spawnLocalInput(ctx, PlayerControls.Player1);

    const client: NetworkClient = new NetworkClient({
      url: this.serverUrl,
      factory: createNetPlayerFactory(instantiator, assetsLoader),
      now: nowSeconds,
    });

    this.client = client;

    registerApplyNetState(ctx.scheduler, world, client.buffer, nowSeconds);

    registerNetEvents(
      ctx.scheduler,
      world,
      scripts,
      client.buffer,
      client.events,
      nowSeconds,
    );

    registerSendInput(ctx.scheduler, world, input, client, nowSeconds);

    this.watchVisibility(client);

    client.connect();
    this.onReady();
  }

  public override onUpdate(dt: number): void {
    this.fpsCallback(1 / dt);
  }

  public override onDestroy(): void {
    if (this.onVisibilityChange !== null) {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      this.onVisibilityChange = null;
    }

    this.client?.close();
    this.client = null;
  }

  /* A hidden tab throttles its frame loop to roughly 1 Hz while snapshots keep arriving, so the
     buffer comes back holding seconds of history the render clock never walked. Replaying it
     would rewind every player. */
  private watchVisibility(client: NetworkClient): void {
    const handler = (): void => {
      if (document.visibilityState === "visible") {
        client.resync(nowSeconds());
      }
    };

    document.addEventListener("visibilitychange", handler);
    this.onVisibilityChange = handler;
  }

  private async loadAssets(
    assetsLoader: AssetsLoader<AssetName>,
  ): Promise<void> {
    for (const asset of SpriteList) {
      assetsLoader.addSprite(asset.name, asset.path);
    }

    for (const audio of AudioList) {
      assetsLoader.addAudio(audio.name, audio.path);
    }

    await assetsLoader.load();
  }
}
