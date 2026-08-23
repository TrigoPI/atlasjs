import { describe, expect, it, vi } from "vitest";
import { Transform2D } from "@atlasjs/math";
import { NebulaRenderer, SceneGraph, TrailNode } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { TrailRenderer, WorldTransform2D } from "../src/components";
import { TrailRenderSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";

const DT: number = 1 / 60;

function setup(): {
  world: NexusWorld;
  scene: SceneGraph;
  system: TrailRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(TrailRenderer);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;

  return {
    world,
    scene,
    system: new TrailRenderSystem(nebula, new SortingLayers()),
  };
}

function mount(world: NexusWorld, x: number, y: number): Entity {
  const entity: Entity = world.createEntity();
  const transform: Transform2D = new Transform2D();
  transform.position.set(x, y);
  world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);
  world.addComponent(entity, TrailRenderer, {
    minVertexDistance: 1,
    time: 0.1,
  });
  return entity;
}

function moveTo(world: NexusWorld, entity: Entity, x: number, y: number): void {
  const transform: Transform2D = new Transform2D();
  transform.position.set(x, y);
  world
    .requireComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);
}

function nodeOf(scene: SceneGraph): TrailNode {
  return scene.root.getChildren()[0] as TrailNode;
}

describe("TrailRenderSystem", () => {
  it("mounts a TrailNode into the scene on the first update", () => {
    const { world, scene, system } = setup();
    mount(world, 0, 0);

    expect(scene.root.getChildren()).toHaveLength(0);

    system.update({ world, dt: DT });

    expect(scene.root.getChildren()).toHaveLength(1);
    expect(nodeOf(scene)).toBeInstanceOf(TrailNode);
  });

  it("propagates the component's settings onto the node", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);
    const component: TrailRenderer = world.requireComponent(
      entity,
      TrailRenderer,
    );

    component.startWidth = 12;
    component.endWidth = 3;
    component.blend = "additive";
    component.maxPoints = 8;

    system.update({ world, dt: DT });

    const node: TrailNode = nodeOf(scene);
    expect(node.startWidth).toBe(12);
    expect(node.endWidth).toBe(3);
    expect(node.blend).toBe("additive");
    expect(node.capacity).toBe(8);
  });

  it("samples the world transform's position when it emits", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });

    const node: TrailNode = nodeOf(scene);
    expect(node.pointCount).toBe(2);
    expect(node.getPointX(0)).toBe(30);
  });

  it("emits nothing when emitting is false", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);
    world.requireComponent(entity, TrailRenderer).emitting = false;

    system.update({ world, dt: DT });
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });

    expect(nodeOf(scene).pointCount).toBe(0);
  });

  it("detaches the trail on entity death, lets it fade out, then leaves the scene", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });
    expect(nodeOf(scene).pointCount).toBe(2);

    system.detach(entity);
    world.destroyEntity(entity);

    expect(scene.root.getChildren()).toHaveLength(1);

    system.update({ world, dt: 0.05 });
    expect(scene.root.getChildren()).toHaveLength(1);

    system.update({ world, dt: 0.2 });
    expect(scene.root.getChildren()).toHaveLength(0);
  });

  it("clear removes the remaining orphans", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    system.detach(entity);
    system.clear();

    expect(scene.root.getChildren()).toHaveLength(0);
  });

  it("drops the points emitted before an emitting pause when emitting turns back on, so the ribbon does not span the gap", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    expect(nodeOf(scene).pointCount).toBe(1);

    world.requireComponent(entity, TrailRenderer).emitting = false;
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });
    expect(nodeOf(scene).pointCount).toBe(1);

    world.requireComponent(entity, TrailRenderer).emitting = true;
    moveTo(world, entity, 100, 0);
    system.update({ world, dt: DT });

    const node: TrailNode = nodeOf(scene);
    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(100);
  });

  it("does not clear the trail while emitting stays true across frames, so the ribbon keeps growing", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });
    moveTo(world, entity, 60, 0);
    system.update({ world, dt: DT });

    expect(nodeOf(scene).pointCount).toBe(3);
  });

  it("component.clear() empties the node and resets the command back to none", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });
    expect(nodeOf(scene).pointCount).toBe(2);

    const component: TrailRenderer = world.requireComponent(
      entity,
      TrailRenderer,
    );
    component.clear();
    expect(component.command).toBe("clear");

    moveTo(world, entity, 60, 0);
    system.update({ world, dt: DT });

    const node: TrailNode = nodeOf(scene);
    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(60);
    expect(component.command).toBe("none");
  });

  it("does not lose the first point when mounting a component that already has emitting: true", () => {
    const { world, scene, system } = setup();
    mount(world, 0, 0);
    const clearSpy = vi.spyOn(TrailNode.prototype, "clear");

    system.update({ world, dt: DT });

    expect(clearSpy).not.toHaveBeenCalled();
    expect(nodeOf(scene).pointCount).toBe(1);

    clearSpy.mockRestore();
  });
});
