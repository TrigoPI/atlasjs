import { describe, expect, it } from "vitest";
import { TIME, TimeControl } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";

import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { TimeApi } from "../src/scripting/services";
import { createHarness, Harness } from "./helpers/harness";

describe("TimeApi", () => {
  it("exposes the TIME_SCALE_MANAGER token", () => {
    expect(TimeApi.token).toBe(TIME_SCALE_MANAGER);
  });

  it("relays the global scale to the core's TimeControl", async () => {
    const harness: Harness = await createHarness();
    const api: TimeApi = new TimeApi(harness.services);
    const time: TimeControl = harness.services.get(TIME);

    api.scale = 0.25;

    expect(time.scale).toBe(0.25);
    expect(api.scale).toBe(0.25);
  });

  it("freeze freezes the passed entities and releases them after the duration", async () => {
    const harness: Harness = await createHarness();
    const api: TimeApi = new TimeApi(harness.services);
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const attacker: Entity = harness.world.createEntity();
    const victim: Entity = harness.world.createEntity();

    api.freeze(0.2, attacker, victim);
    manager.update(0);

    expect(api.scaleOf(attacker)).toBe(0);
    expect(api.scaleOf(victim)).toBe(0);

    manager.update(0.5);

    expect(api.scaleOf(attacker)).toBe(1);
    expect(api.scaleOf(victim)).toBe(1);
  });

  it("setScale then clearScale round-trip", async () => {
    const harness: Harness = await createHarness();
    const api: TimeApi = new TimeApi(harness.services);
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    api.setScale(entity, 0.5);
    manager.update(0);
    expect(api.scaleOf(entity)).toBe(0.5);

    api.clearScale(entity);
    manager.update(0);
    expect(api.scaleOf(entity)).toBe(1);
  });

  it("silently ignores a destroyed entity", async () => {
    const harness: Harness = await createHarness();
    const api: TimeApi = new TimeApi(harness.services);
    const entity: Entity = harness.world.createEntity();
    api.setScale(entity, 0.5);
    harness.world.destroyEntity(entity);

    expect(() => api.freeze(0.2, entity)).not.toThrow();
    expect(() => api.setScale(entity, 0.25)).not.toThrow();
    expect(() => api.clearScale(entity)).not.toThrow();
    expect(api.scaleOf(entity)).toBe(1);
  });
});
