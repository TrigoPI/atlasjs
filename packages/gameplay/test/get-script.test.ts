import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { AtlasScript } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Alpha extends AtlasScript {
  public tag: string = "alpha";
}
class Beta extends AtlasScript {
  public tag: string = "beta";
}
class SubAlpha extends Alpha {}

describe("ScriptManager.getScript", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("returns the instance of the requested type on an entity", () => {
    const e: Entity = h.world.createEntity();
    const a: Alpha = h.scripts.attach(e, Alpha);
    h.scripts.attach(e, Beta);

    expect(h.scripts.getScript(e, Alpha)).toBe(a);
  });

  it("matches subclasses via instanceof", () => {
    const e: Entity = h.world.createEntity();
    const s: SubAlpha = h.scripts.attach(e, SubAlpha);

    expect(h.scripts.getScript(e, Alpha)).toBe(s);
  });

  it("returns undefined when no script of that type is attached", () => {
    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Beta);

    expect(h.scripts.getScript(e, Alpha)).toBeUndefined();
  });

  it("returns undefined for an entity with no scripts", () => {
    const e: Entity = h.world.createEntity();

    expect(h.scripts.getScript(e, Alpha)).toBeUndefined();
  });

  it("stops returning a destroyed script", () => {
    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Alpha);
    h.scripts.destroyAllByEntity(e);

    expect(h.scripts.getScript(e, Alpha)).toBeUndefined();
  });
});
