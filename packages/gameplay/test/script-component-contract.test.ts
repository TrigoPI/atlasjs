import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src/components";
import { AtlasScript, ScriptComponent } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

// A plain data component that adversarially carries a `static engine` pointing
// at a real component — it must still be treated as raw, because it does not
// extend ScriptComponent.
class Decoy {
  public static readonly engine = Transform2D;
  public value: number = 7;
}

class DecoyProbe extends AtlasScript {
  public decoy!: Decoy;

  public onCreate(): void {
    this.decoy = this.addComponent(Decoy);
  }
}

// Extends the façade base but forgets the `static engine` contract.
class BrokenFacade extends ScriptComponent<Transform2D> {}

describe("Gameplay — ScriptComponent contract", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("does not misclassify a raw component that happens to have `static engine`", () => {
    const e: Entity = h.world.createEntity();
    const probe: DecoyProbe = h.scripts.attach(e, DecoyProbe);

    h.frame();

    // Added as itself (raw), never routed through Decoy.engine (Transform2D).
    expect(probe.decoy).toBeInstanceOf(Decoy);
    expect(probe.decoy.value).toBe(7);
    expect(h.world.hasComponent(e, Decoy)).toBe(true);
    expect(h.world.hasComponent(e, Transform2D)).toBe(false);
  });

  it("throws loudly when a façade subclass omits `static engine`", () => {
    const e: Entity = h.world.createEntity();

    expect(() => new BrokenFacade(h.world, e)).toThrow(/static "engine"/);
  });
});
