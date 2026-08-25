import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Entity } from "@atlasjs/nexus";
import { Logger } from "@atlasjs/utils";

import { AtlasScript, ScriptManager } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

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

class DestroyBoom extends AtlasScript {
  public destroyCalls: number = 0;

  public onDestroy(): void {
    this.destroyCalls++;
    throw new Error("boom in destroy");
  }
}

class DestroyOther extends AtlasScript {
  public manager!: ScriptManager;
  public victim!: Entity;
  public destroyCalls: number = 0;

  public onDestroy(): void {
    this.destroyCalls++;
    this.manager.destroyEntityScripts(this.victim);
  }
}

class FlakyUpdate extends AtlasScript {
  public shouldThrow: boolean = true;
  public updateCalls: number = 0;

  public onUpdate(): void {
    this.updateCalls++;

    if (this.shouldThrow) {
      this.shouldThrow = false;
      throw new Error("boom once in update");
    }
  }
}

describe("ScriptManager lifecycle", () => {
  let h: Harness;
  let error: ReturnType<typeof vi.fn>;
  let logger: Logger;
  let sm: ScriptManager;

  beforeEach(async () => {
    h = await createHarness();
    error = vi.fn();
    logger = {
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

  describe("dispose", () => {
    it("runs onDestroy on the scripts that are still alive", () => {
      const entity: Entity = h.world.createEntity();
      const probe: Probe = sm.attach(entity, Probe);

      sm.update(0.1);
      sm.dispose();

      expect(probe.destroyCalls).toBe(1);
    });

    it("leaves no script behind and unbinds every context", () => {
      const first: Entity = h.world.createEntity();
      const second: Entity = h.world.createEntity();
      const a: Probe = sm.attach(first, Probe);
      const b: Probe = sm.attach(second, Probe);

      sm.update(0.1);
      sm.dispose();

      expect(sm.getScriptsByEntity(first)).toHaveLength(0);
      expect(sm.getScriptsByEntity(second)).toHaveLength(0);
      expect(sm.getScript(first, Probe)).toBeUndefined();
      expect(sm.getScript(second, Probe)).toBeUndefined();
      expect(() => a.entityId).toThrow();
      expect(() => b.entityId).toThrow();
    });

    it("drops the scripts that never reached onCreate without calling onDestroy", () => {
      const entity: Entity = h.world.createEntity();
      const probe: Probe = sm.attach(entity, Probe);

      sm.dispose();

      expect(probe.createCalls).toBe(0);
      expect(probe.destroyCalls).toBe(0);
      expect(sm.getScriptsByEntity(entity)).toHaveLength(0);
    });

    it("does not throw on a manager that never attached a script", () => {
      const empty: ScriptManager = new ScriptManager(
        h.world,
        h.services,
        logger,
      );

      expect(() => empty.dispose()).not.toThrow();
    });

    it("keeps tearing the others down when an onDestroy throws", () => {
      const entity: Entity = h.world.createEntity();
      const boom: DestroyBoom = sm.attach(entity, DestroyBoom);
      const probe: Probe = sm.attach(entity, Probe);

      sm.update(0.1);

      expect(() => sm.dispose()).not.toThrow();

      expect(boom.destroyCalls).toBe(1);
      expect(probe.destroyCalls).toBe(1);
      expect(sm.getScriptsByEntity(entity)).toHaveLength(0);
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain("onDestroy");
    });

    it("calls onDestroy once when a teardown destroys another script", () => {
      const victimEntity: Entity = h.world.createEntity();
      const victim: Probe = sm.attach(victimEntity, Probe);

      const entity: Entity = h.world.createEntity();
      const killer: DestroyOther = sm.attach(entity, DestroyOther);
      killer.manager = sm;
      killer.victim = victimEntity;

      sm.update(0.1);

      expect(() => sm.dispose()).not.toThrow();

      expect(killer.destroyCalls).toBe(1);
      expect(victim.destroyCalls).toBe(1);
      expect(sm.getScriptsByEntity(victimEntity)).toHaveLength(0);
      expect(error).not.toHaveBeenCalled();
    });

    it("is idempotent and never replays onDestroy", () => {
      const entity: Entity = h.world.createEntity();
      const probe: Probe = sm.attach(entity, Probe);

      sm.update(0.1);
      sm.dispose();

      expect(() => sm.dispose()).not.toThrow();
      expect(probe.destroyCalls).toBe(1);
    });

    it("stops running scripts once disposed", () => {
      const entity: Entity = h.world.createEntity();
      const probe: Probe = sm.attach(entity, Probe);

      sm.update(0.1);
      sm.dispose();
      sm.update(0.1);

      expect(probe.updateCalls).toBe(1);
    });
  });

  describe("enabling a quarantined script", () => {
    it("reports a script disabled by a throw as not enabled", () => {
      const entity: Entity = h.world.createEntity();
      const flaky: FlakyUpdate = sm.attach(entity, FlakyUpdate);

      sm.update(0.1);

      expect(sm.isEnabled(flaky)).toBe(false);
    });

    it("puts a re-enabled script back into the loop", () => {
      const entity: Entity = h.world.createEntity();
      const flaky: FlakyUpdate = sm.attach(entity, FlakyUpdate);

      sm.update(0.1);
      sm.update(0.1);

      expect(flaky.updateCalls).toBe(1);

      sm.setEnabled(flaky, true);

      expect(sm.isEnabled(flaky)).toBe(true);

      sm.update(0.1);

      expect(flaky.updateCalls).toBe(2);
    });

    it("takes a script back out of the loop when disabled by instance", () => {
      const entity: Entity = h.world.createEntity();
      const probe: Probe = sm.attach(entity, Probe);

      sm.update(0.1);
      sm.setEnabled(probe, false);
      sm.update(0.1);

      expect(probe.updateCalls).toBe(1);
      expect(sm.isEnabled(probe)).toBe(false);

      sm.setEnabled(probe, true);
      sm.update(0.1);

      expect(probe.updateCalls).toBe(2);
    });

    it("reports an unknown or destroyed script as not enabled", () => {
      const entity: Entity = h.world.createEntity();
      const probe: Probe = sm.attach(entity, Probe);
      const orphan: Probe = new Probe();

      sm.update(0.1);

      expect(sm.isEnabled(orphan)).toBe(false);

      sm.destroyEntityScripts(entity);
      sm.update(0.1);

      expect(sm.isEnabled(probe)).toBe(false);
      expect(() => sm.setEnabled(probe, true)).not.toThrow();
    });
  });
});
