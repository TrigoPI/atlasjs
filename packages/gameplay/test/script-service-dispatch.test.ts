import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";

import { AtlasScript, ScriptService } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

interface FakeService {
  value: number;
}

const FAKE: ServiceToken<FakeService> =
  ServiceRegistry.createToken<FakeService>("FAKE_SERVICE_DISPATCH");

class FakeFacade extends ScriptService<FakeService> {
  public static readonly token: ServiceToken<FakeService> = FAKE;

  public read(): number {
    return this.resolve().value;
  }
}

class ServiceProbe extends AtlasScript {
  public first!: FakeFacade;
  public second!: FakeFacade;

  public onCreate(): void {
    this.first = this.getService(FakeFacade);
    this.second = this.getService(FakeFacade);
  }
}

describe("Gameplay — script getService dispatch", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("resolves a service façade from the engine registry", () => {
    h.services.provide(FAKE, { value: 7 });
    const e: Entity = h.world.createEntity();
    const probe: ServiceProbe = h.scripts.attach(e, ServiceProbe);

    h.frame();

    expect(probe.first).toBeInstanceOf(FakeFacade);
    expect(probe.first.read()).toBe(7);
  });

  it("mints a fresh façade per call (stateless)", () => {
    h.services.provide(FAKE, { value: 7 });
    const e: Entity = h.world.createEntity();
    const probe: ServiceProbe = h.scripts.attach(e, ServiceProbe);

    h.frame();

    expect(probe.first).not.toBe(probe.second);
  });

  it("throws when the backing service is not provided", () => {
    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, ServiceProbe);

    expect(() => h.frame()).toThrow(/Service not found/);
  });
});
