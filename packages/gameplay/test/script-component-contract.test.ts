import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src/components";
import { AtlasScript } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

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

describe("Gameplay — script component dispatch (brand, not `static engine`)", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("treats a raw component with a `static engine` as raw (dispatch keys on the brand)", () => {
    const e: Entity = h.world.createEntity();
    const probe: DecoyProbe = h.scripts.attach(e, DecoyProbe);

    h.frame();

    expect(probe.decoy).toBeInstanceOf(Decoy);
    expect(probe.decoy.value).toBe(7);
    expect(h.world.hasComponent(e, Decoy)).toBe(true);
    expect(h.world.hasComponent(e, Transform2D)).toBe(false);
  });
});
