import { describe, expect, it } from "vitest";

import { Engine } from "@atlasjs/core";

import { NEXUS, NexusPlugin, NexusWorld, Entity } from "../src";

class Tag {}

describe("NexusPlugin command-buffer flush", () => {
  it("applies deferred commands at the lane Sync stage each frame", async () => {
    let onTick: ((dt: number) => void) | null = null;

    const engine: Engine = new Engine({
      fixedDelta: 0.1,
      maxSubSteps: 5,
      loop: (cb) => {
        onTick = cb;
        return () => {};
      },
    });

    engine.use(new NexusPlugin());
    await engine.start();

    const world: NexusWorld = engine.services.get<NexusWorld>(NEXUS);
    world.defineComponent(Tag);

    const entity: Entity = world.createEntity();
    world.commands.add(entity, Tag);

    // Deferred: not applied until the scheduler reaches a Sync stage.
    expect(world.hasComponent(entity, Tag)).toBe(false);

    onTick!(0.1 * 1.5); // one fixed tick (+ update + render)

    expect(world.hasComponent(entity, Tag)).toBe(true);
  });
});
