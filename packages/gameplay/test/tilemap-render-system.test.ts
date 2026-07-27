import { describe, expect, it } from "vitest";
import { Bound, Transform2D, Vec2 } from "@atlasjs/math";
import { NebulaRenderer, SceneGraph, TileMapNode } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { TileSet } from "../src/assets/TileSet";
import { Grid, TileMap, TileMapRenderer, WorldTransform2D } from "../src/components";
import { TileMapRenderSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";
import { fakeTexture } from "./helpers/fakes";

function setup(viewport: Bound = new Bound(-100000, -100000, 200000, 200000)): {
  world: NexusWorld;
  scene: SceneGraph;
  system: TileMapRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(WorldTransform2D)
    .defineComponent(Grid)
    .defineComponent(TileMap)
    .defineComponent(TileMapRenderer);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = {
    scene,
    getCameraViewport: (): Bound => viewport,
  } as unknown as NebulaRenderer;

  return { world, scene, system: new TileMapRenderSystem(nebula, new SortingLayers()) };
}

function makeTileSet(): TileSet {
  return new TileSet(fakeTexture("grass", 256, 256), {
    tileWidth: 128,
    tileHeight: 128,
  });
}

function nodes(scene: SceneGraph): ReadonlyArray<TileMapNode> {
  return scene.root.getChildren() as ReadonlyArray<TileMapNode>;
}

describe("TileMapRenderSystem", () => {
  it("mounts one TileMapNode per layer and fills instances from set cells", () => {
    const { world, scene, system } = setup();
    const tileset: TileSet = makeTileSet();

    const grid: Entity = world.createEntity();
    world.addComponent(grid, Grid, new Vec2(128, 128));

    const layer: Entity = world.createEntity();
    world.addComponent(layer, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    const map: TileMap = world.addComponent(layer, TileMap, tileset);
    const renderer: TileMapRenderer = world.addComponent(layer, TileMapRenderer, 7);
    world.setParent(layer, grid);

    map.fill(0, 0, 1, 1, 0);

    system.update({ world, dt: 0 });

    expect(nodes(scene).length).toBe(1);
    const node: TileMapNode = nodes(scene)[0];
    expect(node.instances.length).toBe(4);
    expect(node.sortPrimary).toBe(7);
    expect(node.texture).toBe(tileset.texture);
    expect(renderer.sortingOrder).toBe(7);
  });

  it("skips a layer that has no Grid parent", () => {
    const { world, scene, system } = setup();
    const tileset: TileSet = makeTileSet();

    const layer: Entity = world.createEntity();
    world.addComponent(layer, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    const map: TileMap = world.addComponent(layer, TileMap, tileset);
    world.addComponent(layer, TileMapRenderer);
    map.setTile(0, 0, 0);

    system.update({ world, dt: 0 });

    expect(nodes(scene).length).toBe(0);
  });

  it("unmounts the node when asked", () => {
    const { world, scene, system } = setup();
    const tileset: TileSet = makeTileSet();

    const grid: Entity = world.createEntity();
    world.addComponent(grid, Grid, new Vec2(128, 128));
    const layer: Entity = world.createEntity();
    world.addComponent(layer, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    world.addComponent(layer, TileMap, tileset).setTile(0, 0, 0);
    world.addComponent(layer, TileMapRenderer);
    world.setParent(layer, grid);

    system.update({ world, dt: 0 });
    expect(nodes(scene).length).toBe(1);

    system.unmount(layer);
    expect(nodes(scene).length).toBe(0);
  });

  it("culls cells outside the camera viewport", () => {
    const { world, scene, system } = setup(new Bound(-64, -64, 256, 256));
    const tileset: TileSet = makeTileSet();

    const grid: Entity = world.createEntity();
    world.addComponent(grid, Grid, new Vec2(128, 128));
    const layer: Entity = world.createEntity();
    world.addComponent(layer, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    const map: TileMap = world.addComponent(layer, TileMap, tileset);
    world.addComponent(layer, TileMapRenderer);
    world.setParent(layer, grid);

    map.setTile(0, 0, 0);
    map.setTile(100, 100, 0);

    system.update({ world, dt: 0 });

    const node: TileMapNode = nodes(scene)[0];
    expect(node.instances.length).toBe(1);
    expect(node.instances[0].x).toBe(0);
    expect(node.instances[0].y).toBe(0);
  });
});
