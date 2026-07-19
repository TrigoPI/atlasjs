import { describe, expect, it } from "vitest";
import { Bound, Transform2D, Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { Camera, WorldTransform2D } from "../src/components";
import { CameraManager } from "../src/camera";
import { CameraSyncSystem } from "../src/systems";

const LOGICAL_W: number = 800;
const LOGICAL_H: number = 600;

function fakeNebula(camera: Camera2D): NebulaRenderer {
  return {
    camera,
    getCameraViewport(): Bound {
      return Bound.create(
        camera.position.x,
        camera.position.y,
        LOGICAL_W / camera.zoom,
        LOGICAL_H / camera.zoom,
      );
    },
  } as unknown as NebulaRenderer;
}

function setup(): {
  world: NexusWorld;
  camera2d: Camera2D;
  manager: CameraManager;
  system: CameraSyncSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(Camera).defineComponent(WorldTransform2D);

  const camera2d: Camera2D = new Camera2D();
  const nebula: NebulaRenderer = fakeNebula(camera2d);
  const manager: CameraManager = new CameraManager(nebula);
  const system: CameraSyncSystem = new CameraSyncSystem(manager, nebula);

  return { world, camera2d, manager, system };
}

function makeCamera(world: NexusWorld, cx: number, cy: number, zoom: number): Entity {
  const entity: Entity = world.createEntity();
  const cam: Camera = world.addComponent(entity, Camera);
  cam.zoom = zoom;
  const transform: Transform2D = new Transform2D().setPosition(cx, cy);
  world.addComponent(entity, WorldTransform2D).matrix.fromTransform2D(transform);
  return entity;
}

describe("CameraSyncSystem", () => {
  it("bakes the centered position and zoom into the render camera", () => {
    const { world, camera2d, manager, system } = setup();
    const entity: Entity = makeCamera(world, 500, 300, 2);
    manager.setActive(entity);

    system.update({ world, dt: 0 });

    expect(camera2d.zoom).toBe(2);
    expect(camera2d.position.x).toBeCloseTo(500 - LOGICAL_W / 2 / 2);
    expect(camera2d.position.y).toBeCloseTo(300 - LOGICAL_H / 2 / 2);
  });

  it("round-trips: screen center maps back to the camera world center", () => {
    const { world, camera2d, manager, system } = setup();
    const entity: Entity = makeCamera(world, 500, 300, 2);
    manager.setActive(entity);

    system.update({ world, dt: 0 });
    const center: Vec2 = camera2d.screenToWorld(new Vec2(LOGICAL_W / 2, LOGICAL_H / 2));

    expect(center.x).toBeCloseTo(500);
    expect(center.y).toBeCloseTo(300);
  });

  it("does nothing when there is no active camera", () => {
    const { world, camera2d, system } = setup();
    camera2d.setPosition(42, 42).setZoom(9);

    system.update({ world, dt: 0 });

    expect(camera2d.position.x).toBe(42);
    expect(camera2d.position.y).toBe(42);
    expect(camera2d.zoom).toBe(9);
  });

  it("does nothing when the active entity lacks Camera/WorldTransform2D", () => {
    const { world, camera2d, manager, system } = setup();
    const bare: Entity = world.createEntity();
    manager.setActive(bare);
    camera2d.setPosition(7, 7).setZoom(3);

    system.update({ world, dt: 0 });

    expect(camera2d.position.x).toBe(7);
    expect(camera2d.zoom).toBe(3);
  });
});
