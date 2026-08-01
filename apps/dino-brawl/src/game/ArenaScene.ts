import { Vec2 } from "@atlasjs/math";
import { type SceneContext, Scene } from "@atlasjs/core";
import { type SortingLayers, SORTING_LAYERS } from "@atlasjs/gameplay";

import { SortingLayer } from "./config";
import type { BuiltMap, WorldPoint } from "./tiled";
import { spawnCamera, spawnPlayer, spawnSword, spawnWorld } from "./spawn";

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

    console.log(builtMap);

    const { player } = await spawnPlayer(ctx, spawnPosition);
    await spawnSword(ctx, player);
    // await spawnProps(ctx, spawnPosition);

    spawnCamera(ctx, player);
  }

  public onUpdate(dt: number): void {
    this.fpsCallback(1 / dt);
  }
}
