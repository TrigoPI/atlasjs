import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Camera, CameraManager, CAMERA_MANAGER } from "../src";
import { createHarness, Harness } from "./helpers/harness";

describe("GameplayPlugin — camera wiring", () => {
  it("provides the CameraManager service", async () => {
    const h: Harness = await createHarness();
    const manager: CameraManager = h.services.get(CAMERA_MANAGER);
    expect(manager).toBeInstanceOf(CameraManager);
  });

  it("clears the active camera when its Camera component is removed", async () => {
    const h: Harness = await createHarness();
    const manager: CameraManager = h.services.get(CAMERA_MANAGER);

    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, Camera);
    manager.setActive(entity);
    expect(manager.getActive()).toBe(entity);

    h.world.removeComponent(entity, Camera);
    expect(manager.getActive()).toBeUndefined();
  });
});
