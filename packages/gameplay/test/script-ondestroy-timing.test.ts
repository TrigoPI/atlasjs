import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Entity } from "@atlasjs/nexus";
import { Logger } from "@atlasjs/utils";

import { Transform2D } from "../src/components";
import { AtlasScript, ScriptManager, Transform } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class PositionReader extends AtlasScript {
  public destroyCalls: number = 0;
  public readX: number = Number.NaN;
  public failure: string = "";

  public onDestroy(): void {
    this.destroyCalls++;

    try {
      const transform: Transform = this.requireComponent(Transform);
      this.readX = transform.position.x;
    } catch (error: unknown) {
      this.failure = (error as Error).message;
    }
  }
}

class SelfDestroyer extends AtlasScript {
  public destroyCalls: number = 0;
  public readX: number = Number.NaN;
  public failure: string = "";

  public onUpdate(): void {
    this.destroy();
  }

  public onDestroy(): void {
    this.destroyCalls++;

    try {
      const transform: Transform = this.requireComponent(Transform);
      this.readX = transform.position.x;
    } catch (error: unknown) {
      this.failure = (error as Error).message;
    }
  }
}

class Counter extends AtlasScript {
  public destroyCalls: number = 0;

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

function spawnAt(h: Harness, x: number): Entity {
  const entity: Entity = h.world.createEntity();
  const transform: Transform2D = h.world.addComponent(entity, Transform2D);
  transform.position.x = x;
  return entity;
}

describe("onDestroy timing on world-driven destruction", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("runs onDestroy in the same frame as world.commands.destroy", () => {
    const entity: Entity = spawnAt(h, 42);
    const probe: PositionReader = h.scripts.attach(entity, PositionReader);

    h.frame();
    expect(probe.destroyCalls).toBe(0);

    h.world.commands.destroy(entity);
    h.frame();

    expect(probe.destroyCalls).toBe(1);
  });

  it("exposes the entity components to onDestroy even when the component was added before the script", () => {
    const entity: Entity = spawnAt(h, 42);
    const probe: PositionReader = h.scripts.attach(entity, PositionReader);

    h.frame();
    h.world.commands.destroy(entity);
    h.frame();

    expect(probe.failure).toBe("");
    expect(probe.readX).toBe(42);
  });

  it("still exposes the entity components to onDestroy on a destroyed child", () => {
    const parent: Entity = spawnAt(h, 1);
    const child: Entity = spawnAt(h, 7);
    h.world.setParent(child, parent);

    const probe: PositionReader = h.scripts.attach(child, PositionReader);

    h.frame();
    h.world.commands.destroy(parent);
    h.frame();

    expect(probe.destroyCalls).toBe(1);
    expect(probe.failure).toBe("");
    expect(probe.readX).toBe(7);
  });

  it("runs onDestroy exactly once through the GameEntity.destroy path", () => {
    const entity: Entity = spawnAt(h, 42);
    const probe: SelfDestroyer = h.scripts.attach(entity, SelfDestroyer);

    h.frame();
    h.frame();
    h.frame();

    expect(probe.destroyCalls).toBe(1);
    expect(probe.failure).toBe("");
    expect(probe.readX).toBe(42);
    expect(h.world.exists(entity)).toBe(false);
    expect(h.scripts.getScriptsByEntity(entity)).toHaveLength(0);
  });

  it("runs onDestroy exactly once when a manual destroyEntityScripts precedes the world destroy", () => {
    const entity: Entity = spawnAt(h, 42);
    const probe: Counter = h.scripts.attach(entity, Counter);

    h.frame();

    h.scripts.destroyEntityScripts(entity);
    h.world.commands.destroy(entity);
    h.frame();
    h.frame();

    expect(probe.destroyCalls).toBe(1);
  });

  it("keeps destroying the entity and the sibling scripts when an onDestroy throws", () => {
    const error: ReturnType<typeof vi.fn> = vi.fn();
    const logger: Logger = {
      warn: vi.fn(),
      error,
      log: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
    const sm: ScriptManager = new ScriptManager(h.world, h.services, logger);

    const entity: Entity = spawnAt(h, 42);
    const boom: DestroyBoom = sm.attach(entity, DestroyBoom);
    const probe: Counter = sm.attach(entity, Counter);

    sm.update(0.1);

    expect(() => {
      h.world.commands.destroy(entity);
      h.frame();
    }).not.toThrow();

    expect(boom.destroyCalls).toBe(1);
    expect(probe.destroyCalls).toBe(1);
    expect(h.world.exists(entity)).toBe(false);
    expect(sm.getScriptsByEntity(entity)).toHaveLength(0);
    expect(() => boom.entityId).toThrow();
    expect(() => probe.entityId).toThrow();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain("onDestroy");

    sm.update(0.1);
    expect(boom.destroyCalls).toBe(1);
    expect(probe.destroyCalls).toBe(1);
  });
});
