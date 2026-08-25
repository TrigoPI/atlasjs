import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Entity } from "@atlasjs/nexus";
import { Logger } from "@atlasjs/utils";

import { AtlasScript, ScriptManager } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class UpdateBoom extends AtlasScript {
  public updateCalls: number = 0;

  public onUpdate(): void {
    this.updateCalls++;
    throw new Error("boom in update");
  }
}

class CreateBoom extends AtlasScript {
  public updateCalls: number = 0;

  public onCreate(): void {
    throw new Error("boom in create");
  }

  public onUpdate(): void {
    this.updateCalls++;
  }
}

class DestroyBoom extends AtlasScript {
  public destroyCalls: number = 0;

  public onDestroy(): void {
    this.destroyCalls++;
    throw new Error("boom in destroy");
  }
}

class DestroyThenBoom extends AtlasScript {
  public manager!: ScriptManager;
  public victim!: Entity;

  public onUpdate(): void {
    this.manager.destroyEntityScripts(this.victim);
    throw new Error("boom after scheduling a destroy");
  }
}

class Probe extends AtlasScript {
  public createCalls: number = 0;
  public updateCalls: number = 0;
  public destroyCalls: number = 0;

  public onCreate(): void {
    this.createCalls++;
  }

  public onUpdate(): void {
    this.updateCalls++;
  }

  public onDestroy(): void {
    this.destroyCalls++;
  }
}

describe("script error isolation", () => {
  let h: Harness;
  let error: ReturnType<typeof vi.fn>;
  let sm: ScriptManager;

  beforeEach(async () => {
    h = await createHarness();
    error = vi.fn();
    const logger: Logger = {
      warn: vi.fn(),
      error,
      log: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
    sm = new ScriptManager(h.world, h.services, logger);
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("keeps the frame alive when a script throws in onUpdate", () => {
    const faulty: Entity = h.world.createEntity();
    h.scripts.attach(faulty, UpdateBoom);

    const healthy: Entity = h.world.createEntity();
    const probe: Probe = h.scripts.attach(healthy, Probe);

    expect(() => h.frame()).not.toThrow();
    expect(probe.updateCalls).toBeGreaterThan(0);
  });

  it("runs the remaining scripts of the same frame after a throw", () => {
    const faulty: Entity = h.world.createEntity();
    const boom: UpdateBoom = sm.attach(faulty, UpdateBoom);

    const healthy: Entity = h.world.createEntity();
    const probe: Probe = sm.attach(healthy, Probe);

    sm.update(0.1);

    expect(boom.updateCalls).toBe(1);
    expect(probe.updateCalls).toBe(1);
  });

  it("stops calling a script that threw on the following frames", () => {
    const faulty: Entity = h.world.createEntity();
    const boom: UpdateBoom = sm.attach(faulty, UpdateBoom);

    const healthy: Entity = h.world.createEntity();
    const probe: Probe = sm.attach(healthy, Probe);

    sm.update(0.1);
    sm.update(0.1);
    sm.update(0.1);

    expect(boom.updateCalls).toBe(1);
    expect(probe.updateCalls).toBe(3);
  });

  it("still flushes pending destroys in the frame where a script threw", () => {
    const victim: Entity = h.world.createEntity();
    const probe: Probe = sm.attach(victim, Probe);

    const faulty: Entity = h.world.createEntity();
    const boom: DestroyThenBoom = sm.attach(faulty, DestroyThenBoom);
    boom.manager = sm;
    boom.victim = victim;

    sm.update(0.1);

    expect(probe.destroyCalls).toBe(1);
    expect(sm.getScriptsByEntity(victim)).toHaveLength(0);
  });

  it("runs the remaining onCreate hooks after one of them throws", () => {
    const faulty: Entity = h.world.createEntity();
    const boom: CreateBoom = sm.attach(faulty, CreateBoom);

    const healthy: Entity = h.world.createEntity();
    const probe: Probe = sm.attach(healthy, Probe);

    sm.update(0.1);
    sm.update(0.1);

    expect(probe.createCalls).toBe(1);
    expect(probe.updateCalls).toBe(2);
    expect(boom.updateCalls).toBe(0);
  });

  it("cleans up the remaining scripts after an onDestroy throws", () => {
    const entity: Entity = h.world.createEntity();
    const boom: DestroyBoom = sm.attach(entity, DestroyBoom);
    const probe: Probe = sm.attach(entity, Probe);

    sm.update(0.1);
    sm.destroyEntityScripts(entity);
    sm.update(0.1);

    expect(boom.destroyCalls).toBe(1);
    expect(probe.destroyCalls).toBe(1);
    expect(sm.getScriptsByEntity(entity)).toHaveLength(0);
    expect(() => boom.entityId).toThrow();
    expect(() => probe.entityId).toThrow();

    sm.update(0.1);

    expect(probe.destroyCalls).toBe(1);
  });

  it("logs which script was disabled and why", () => {
    const faulty: Entity = h.world.createEntity();
    sm.attach(faulty, UpdateBoom);

    sm.update(0.1);

    expect(error).toHaveBeenCalledTimes(1);

    const message: string = error.mock.calls[0][0] as string;

    expect(message).toContain("UpdateBoom");
    expect(message).toContain(String(faulty));
    expect(message).toContain("onUpdate");
    expect(message).toMatch(/disabled/i);
    expect(message).toContain("boom in update");
  });

  it("logs an onCreate failure and an onDestroy failure", () => {
    const created: Entity = h.world.createEntity();
    sm.attach(created, CreateBoom);

    sm.update(0.1);

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain("onCreate");

    const destroyed: Entity = h.world.createEntity();
    sm.attach(destroyed, DestroyBoom);

    sm.update(0.1);
    sm.destroyEntityScripts(destroyed);
    sm.update(0.1);

    expect(error).toHaveBeenCalledTimes(2);
    expect(error.mock.calls[1][0]).toContain("onDestroy");
  });
});
