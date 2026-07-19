import { describe, expect, it } from "vitest";
import { ServiceRegistry } from "@atlasjs/core";
import { Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer } from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

import { CameraManager, CAMERA_MANAGER } from "../src/camera";
import { CameraApi } from "../src/scripting/services";

function fakeNebula(camera: Camera2D): NebulaRenderer {
  return { camera } as unknown as NebulaRenderer;
}

function setup(): { manager: CameraManager; api: CameraApi } {
  const camera: Camera2D = new Camera2D();
  camera.setPosition(100, 50).setZoom(2);
  const manager: CameraManager = new CameraManager(fakeNebula(camera));

  const services: ServiceRegistry = new ServiceRegistry();
  services.provide(CAMERA_MANAGER, manager);

  return { manager, api: new CameraApi(services) };
}

describe("CameraApi", () => {
  it("exposes the CAMERA_MANAGER token", () => {
    expect(CameraApi.token).toBe(CAMERA_MANAGER);
  });

  it("delegates screenToWorld to the manager", () => {
    const { api } = setup();
    const world: Vec2 = api.screenToWorld(new Vec2(800, 600));
    expect(world.x).toBeCloseTo(100 + 400);
    expect(world.y).toBeCloseTo(50 + 300);
  });

  it("setMain forwards to the manager", () => {
    const { manager, api } = setup();
    const entity: Entity = 5 as unknown as Entity;
    api.setMain(entity);
    expect(manager.getActive()).toBe(entity);
  });
});
