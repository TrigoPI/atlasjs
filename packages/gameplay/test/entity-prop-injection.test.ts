import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Entity } from "@atlasjs/nexus";
import { Logger } from "@atlasjs/utils";

import {
  AtlasScript,
  GameEntity,
  ScriptManager,
  ScriptMetadata,
  Transform,
  registerScriptMetadata,
} from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Piloted extends AtlasScript {
  public hp: number = 7;
}

class Pilot extends AtlasScript<{ target: GameEntity }> {
  public target!: GameEntity;
  public targetScript: Piloted | undefined;
  public targetX: number | undefined;

  public onCreate(): void {
    this.targetScript = this.target.getScript(Piloted);
    this.target.addComponent(Transform).setPosition(3, 4);
    this.targetX = this.target.requireComponent(Transform).position.x;
  }
}
registerScriptMetadata(Pilot, {
  exposed: { target: ScriptMetadata.entity({ required: true }) },
});

describe("attach — entity ref injection", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("wraps a raw Entity prop into a GameEntity handle", () => {
    const target: Entity = h.world.createEntity();
    const tScript: Piloted = h.scripts.attach(target, Piloted);

    const pilotEntity: Entity = h.world.createEntity();
    const pilot: Pilot = h.scripts.attach(pilotEntity, Pilot, { target });

    h.frame();

    expect(pilot.target.id).toBe(target);
    expect(pilot.targetScript).toBe(tScript);
    expect(pilot.targetX).toBe(3);
  });

  it("warns when a required entity ref is missing", () => {
    const warn = vi.fn();
    const logger: Logger = {
      warn,
      error: vi.fn(),
      log: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
    const sm: ScriptManager = new ScriptManager(h.world, h.services, logger);
    const e: Entity = h.world.createEntity();

    sm.attach(e, Pilot, {} as { target: Entity });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("target");
  });

  it("type: accepts a raw Entity at the call site, rejects a non-Entity", () => {
    const target: Entity = h.world.createEntity();
    const e: Entity = h.world.createEntity();

    h.scripts.attach(e, Pilot, { target });
    // @ts-expect-error — a plain object is not an Entity
    h.scripts.attach(e, Pilot, { target: {} });
  });
});
