import { describe, expect, it } from "vitest";

import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { ScriptService } from "../src/scripting";

interface FakeService {
  value: number;
}

const FAKE: ServiceToken<FakeService> =
  ServiceRegistry.createToken<FakeService>("FAKE_SERVICE");

class FakeFacade extends ScriptService<FakeService> {
  public static readonly token: ServiceToken<FakeService> = FAKE;

  public read(): number {
    return this.provided.value;
  }
}

class BrokenFacade extends ScriptService<FakeService> {}

describe("Gameplay — ScriptService contract", () => {
  it("resolves the backing service via its static token", () => {
    const services: ServiceRegistry = new ServiceRegistry();
    services.provide(FAKE, { value: 42 });

    const facade: FakeFacade = new FakeFacade(services);

    expect(facade.read()).toBe(42);
  });

  it("throws loudly when a service façade omits `static token`", () => {
    const services: ServiceRegistry = new ServiceRegistry();

    expect(() => new BrokenFacade(services)).toThrow(/static "token"/);
  });

  it("throws at construction when the backing service is not provided", () => {
    const services: ServiceRegistry = new ServiceRegistry();

    expect(() => new FakeFacade(services)).toThrow(/Service not found/);
  });
});
