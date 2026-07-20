import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer } from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

import { CameraManager } from "../src/camera";

function fakeNebula(camera: Camera2D): NebulaRenderer {
  return { camera } as unknown as NebulaRenderer;
}

describe("CameraManager", () => {
  it("tracks the active camera entity", () => {
    const manager: CameraManager = new CameraManager(fakeNebula(new Camera2D()));
    expect(manager.getActive()).toBeUndefined();

    const entity: Entity = 7 as unknown as Entity;
    manager.setActive(entity);
    expect(manager.getActive()).toBe(entity);

    manager.setActive(undefined);
    expect(manager.getActive()).toBeUndefined();
  });

  it("delegates screenToWorld to the render camera", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(100, 50).setZoom(2);
    const manager: CameraManager = new CameraManager(fakeNebula(camera));

    const world: Vec2 = manager.screenToWorld(new Vec2(800, 600));

    expect(world.x).toBeCloseTo(100 + 400);
    expect(world.y).toBeCloseTo(50 + 300);
  });

  it("delegates worldToScreen to the render camera", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(0, 0).setZoom(2);
    const manager: CameraManager = new CameraManager(fakeNebula(camera));

    const screen: Vec2 = manager.worldToScreen(new Vec2(10, 20));

    expect(screen.x).toBeCloseTo(20);
    expect(screen.y).toBeCloseTo(40);
  });
});
