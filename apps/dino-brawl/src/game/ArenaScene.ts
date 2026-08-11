import { Vec2 } from "@atlasjs/math";
import { type SceneContext, Scene } from "@atlasjs/core";
import { NEXUS, type NexusWorld, type Entity } from "@atlasjs/nexus";
import { ASSET_MANAGER, type AssetManager } from "@atlasjs/assets";
import { AudioClipAsset, type AudioClip } from "@atlasjs/audio";
import {
  type SortingLayers,
  SORTING_LAYERS,
  AudioSource,
} from "@atlasjs/gameplay";

import { SortingLayer } from "./config";
import type { BuiltMap, WorldPoint } from "./tiled";
import { spawnCamera, spawnPlayer, spawnWorld } from "./spawn";
import { ResourcesPath } from "./ResourcesPath";

export class ArenaScene extends Scene {
  private fpsCallback: (fps: number) => void;

  public constructor(cb: (fps: number) => void) {
    super("game-scene");
    this.fpsCallback = cb;
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const sortingLayers: SortingLayers = ctx.services.get(SORTING_LAYERS);

    sortingLayers.define([
      { name: SortingLayer.Ground, mode: "manual" },
      { name: SortingLayer.Entities, mode: "ySorted" },
      { name: SortingLayer.Overhead, mode: "manual" },
    ]);

    const builtMap: BuiltMap = await spawnWorld(ctx);
    const spawn: WorldPoint | undefined = builtMap.points["spawn_point"];
    const spawnPosition: Vec2 = spawn
      ? Vec2.create(spawn.x, spawn.y)
      : Vec2.zero();

    const { player } = await spawnPlayer(ctx, spawnPosition);
    // await spawnSword(ctx, player);

    spawnCamera(ctx, player);

    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const world: NexusWorld = ctx.services.get(NEXUS);
    const music: AudioClip = await assets.load<AudioClip>(
      new AudioClipAsset(ResourcesPath.Audio.Music),
    );
    const musicEntity: Entity = world.createEntity();
    world.addComponent(musicEntity, AudioSource, music, {
      loop: true,
      playOnAwake: true,
      volume: 0.5,
    });
  }

  public onUpdate(dt: number): void {
    this.fpsCallback(1 / dt);
  }
}
