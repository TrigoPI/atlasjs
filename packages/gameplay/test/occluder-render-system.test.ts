import { describe, expect, it } from "vitest";
import { Transform2D, Vec4 } from "@atlasjs/math";
import { SceneGraph, TileMapNode } from "@atlasjs/nebula";
import type { NebulaRenderer, TileInstance, Texture2D } from "@atlasjs/nebula";
import { NexusWorld } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { WorldTransform2D } from "../src/components/WorldTransform2D";
import { OccluderStrip } from "../src/components/OccluderStrip";
import { SortingLayers } from "../src/rendering/SortingLayers";
import { OccluderRenderSystem } from "../src/systems/OccluderRenderSystem";

function setup(): {
  world: NexusWorld;
  scene: SceneGraph;
  system: OccluderRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(OccluderStrip);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;

  const layers: SortingLayers = new SortingLayers();
  layers.define([{ name: "Entities", mode: "ySorted" }]);

  return { world, scene, system: new OccluderRenderSystem(nebula, layers) };
}

function nodes(scene: SceneGraph): ReadonlyArray<TileMapNode> {
  return scene.root.getChildren() as ReadonlyArray<TileMapNode>;
}

function texture(): Texture2D {
  return { width: 128, height: 128 } as unknown as Texture2D;
}

function tiles(): TileInstance[] {
  return [
    { x: 0, y: 0, width: 32, height: 32, uvRect: new Vec4(0, 0, 0.25, 0.25) },
  ];
}

describe("OccluderRenderSystem", () => {
  it("monte un TileMapNode par strip, trié par footY (couche ySorted)", () => {
    const { world, scene, system } = setup();
    const strip: TileInstance[] = tiles();
    const tex: Texture2D = texture();

    const e: Entity = world.createEntity();
    world
      .addComponent(e, WorldTransform2D)
      .matrix.fromTransform2D(new Transform2D());
    world.addComponent(e, OccluderStrip, 160, strip, tex, "Entities");

    system.update({ world, dt: 0 });

    expect(nodes(scene).length).toBe(1);
    const node: TileMapNode = nodes(scene)[0];
    expect(node.instances).toBe(strip);
    expect(node.texture).toBe(tex);
    expect(node.sortPrimary).toBe(160);
  });

  it("hérite l'échelle du WorldTransform2D", () => {
    const { world, scene, system } = setup();
    const t: Transform2D = new Transform2D();
    t.scale.set(2, 2);

    const e: Entity = world.createEntity();
    world.addComponent(e, WorldTransform2D).matrix.fromTransform2D(t);
    world.addComponent(e, OccluderStrip, 10, tiles(), texture(), "Entities");

    system.update({ world, dt: 0 });

    expect(nodes(scene)[0].transform.scale.x).toBe(2);
  });

  it("ne reconstruit pas les instances entre deux frames (statique)", () => {
    const { world, scene, system } = setup();
    const strip: TileInstance[] = tiles();

    const e: Entity = world.createEntity();
    world
      .addComponent(e, WorldTransform2D)
      .matrix.fromTransform2D(new Transform2D());
    world.addComponent(e, OccluderStrip, 5, strip, texture(), "Entities");

    system.update({ world, dt: 0 });
    system.update({ world, dt: 0 });

    expect(nodes(scene).length).toBe(1);
    expect(nodes(scene)[0].instances).toBe(strip);
  });

  it("unmount retire le node de la scène", () => {
    const { world, scene, system } = setup();
    const e: Entity = world.createEntity();
    world
      .addComponent(e, WorldTransform2D)
      .matrix.fromTransform2D(new Transform2D());
    world.addComponent(e, OccluderStrip, 5, tiles(), texture(), "Entities");

    system.update({ world, dt: 0 });
    expect(nodes(scene).length).toBe(1);

    system.unmount(e);
    expect(nodes(scene).length).toBe(0);
  });
});
