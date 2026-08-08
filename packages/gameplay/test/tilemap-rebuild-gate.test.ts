import { describe, expect, it, vi } from "vitest";
import { Bound, Transform2D, Vec2 } from "@atlasjs/math";
import { NebulaRenderer, SceneGraph, TileMapNode } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { TileSet } from "../src/assets/TileSet";
import {
  Grid,
  TileMap,
  TileMapRenderer,
  WorldTransform2D,
} from "../src/components";
import { TileMapRenderSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";
import { fakeTexture } from "./helpers/fakes";

type Rig = {
  world: NexusWorld;
  scene: SceneGraph;
  system: TileMapRenderSystem;
  viewport: Bound;
  setViewport: (bound: Bound) => void;
  frame: () => void;
  map: TileMap;
  node: () => TileMapNode;
};

function makeTileSet(): TileSet {
  return new TileSet(fakeTexture("grass", 256, 256), {
    tileWidth: 128,
    tileHeight: 128,
  });
}

function setup(initialViewport: Bound): Rig {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(WorldTransform2D)
    .defineComponent(Grid)
    .defineComponent(TileMap)
    .defineComponent(TileMapRenderer);

  const scene: SceneGraph = new SceneGraph();
  let viewport: Bound = initialViewport;
  const nebula: NebulaRenderer = {
    scene,
    getCameraViewport: (): Bound => viewport,
  } as unknown as NebulaRenderer;

  const system: TileMapRenderSystem = new TileMapRenderSystem(
    nebula,
    new SortingLayers(),
  );

  const tileset: TileSet = makeTileSet();
  const grid: Entity = world.createEntity();
  world.addComponent(grid, Grid, new Vec2(128, 128));

  const layer: Entity = world.createEntity();
  world
    .addComponent(layer, WorldTransform2D)
    .matrix.fromTransform2D(new Transform2D());
  const map: TileMap = world.addComponent(layer, TileMap, tileset);
  world.addComponent(layer, TileMapRenderer);
  world.setParent(layer, grid);

  const frame = (): void => system.update({ world, dt: 0 });
  const node = (): TileMapNode => scene.root.getChildren()[0] as TileMapNode;

  return {
    world,
    scene,
    system,
    viewport,
    setViewport: (bound: Bound): void => {
      viewport = bound;
    },
    frame,
    map,
    node,
  };
}

describe("TileMapRenderSystem rebuild gate", () => {
  it("does NOT rebuild instances on a steady frame with no change", () => {
    const rig: Rig = setup(new Bound(-10, -10, 200, 200));
    rig.map.fill(0, 0, 1, 1, 0);

    rig.frame();
    expect(rig.node().instances.length).toBe(4);

    const getTileSpy = vi.spyOn(rig.map, "getTile");
    const uvBefore: ReadonlyArray<object> = rig
      .node()
      .instances.map((i) => i.uvRect);

    rig.frame();
    rig.frame();

    expect(getTileSpy).not.toHaveBeenCalled();

    const uvAfter: ReadonlyArray<object> = rig
      .node()
      .instances.map((i) => i.uvRect);
    expect(uvAfter.length).toBe(uvBefore.length);
    uvAfter.forEach((v, idx) => expect(v).toBe(uvBefore[idx]));
  });

  it("rebuilds when a tile is edited (revision bump)", () => {
    const rig: Rig = setup(new Bound(-10, -10, 200, 200));
    rig.map.setTile(0, 0, 0);

    rig.frame();
    expect(rig.node().instances.length).toBe(1);

    const getTileSpy = vi.spyOn(rig.map, "getTile");
    rig.map.setTile(1, 1, 0);
    rig.frame();

    expect(getTileSpy).toHaveBeenCalled();
    expect(rig.node().instances.length).toBe(2);
  });

  it("rebuilds when the camera moves so the visible CellRange changes", () => {
    const rig: Rig = setup(new Bound(-10, -10, 200, 200));
    rig.map.setTile(0, 0, 0);
    rig.map.setTile(5, 5, 0);

    rig.frame();
    expect(rig.node().instances.length).toBe(1);

    const getTileSpy = vi.spyOn(rig.map, "getTile");
    rig.setViewport(new Bound(-10, -10, 800, 800));
    rig.frame();

    expect(getTileSpy).toHaveBeenCalled();
    expect(rig.node().instances.length).toBe(2);
  });
});
