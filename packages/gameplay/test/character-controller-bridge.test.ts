import { describe, expect, it } from "vitest";
import { createHarness, Harness } from "./helpers/harness";
import { CharacterController2D } from "../src/components/CharacterController2D";
import { CharacterControllerRef } from "../src/components/CharacterControllerRef";
import type { Entity } from "@atlasjs/nexus";

describe("CharacterController lifecycle bridge", () => {
  it("mints a CharacterControllerRef and a physics controller when CharacterController2D appears", async () => {
    const h: Harness = await createHarness();
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, CharacterController2D);

    h.frame();

    expect(h.world.hasComponent(e, CharacterControllerRef)).toBe(true);
    expect(h.physics.characterControllerCount).toBe(1);
  });

  it("frees the controller when the entity is destroyed", async () => {
    const h: Harness = await createHarness();
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, CharacterController2D);
    h.frame();

    h.world.destroyEntity(e);
    h.frame();

    expect(h.physics.characterControllerCount).toBe(0);
  });
});
