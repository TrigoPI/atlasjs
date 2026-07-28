import { Vec2 } from "@atlasjs/math";
import { type SceneContext, Scene } from "@atlasjs/core";

import {
  type SortingLayers,
  SORTING_LAYERS,
} from "@atlasjs/gameplay";

import type { PinObject } from "./tiled";
import { MapLoader } from "./tiled";
import { ResourcesPath } from "./ResourcesPath";
import { SortingLayer, MAP_SCALE } from "./config";
import {
  spawnCamera,
  spawnPlayer,
  spawnProps,
  spawnSword,
  spawnWorld,
} from "./spawn";

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

    const mapLoader: MapLoader = new MapLoader(ResourcesPath.Map);
    await spawnWorld(ctx, mapLoader);

    const spawn: PinObject | undefined = mapLoader.getObject<PinObject>("spawn_point");
    const spawnPosition: Vec2 = spawn
      ? Vec2.create(spawn.x, spawn.y).mult(MAP_SCALE)
      : Vec2.zero();

    const { player } = await spawnPlayer(ctx, spawnPosition);
    await spawnSword(ctx, player);
    await spawnProps(ctx, spawnPosition);
    spawnCamera(ctx, player);
  }

  public onUpdate(dt: number): void {
    this.fpsCallback(1 / dt);
  }
}
