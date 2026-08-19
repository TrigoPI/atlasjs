import { describe, expect, it } from "vitest";

import { ServiceRegistry } from "../src/public/engine/ServiceRegistry";
import type { ServiceToken } from "../src/public/engine/types";

describe("ServiceRegistry", () => {
  it("résout un wait enregistré avant le provide", async () => {
    const registry: ServiceRegistry = new ServiceRegistry();
    const token: ServiceToken<string> =
      ServiceRegistry.createToken<string>("A");

    const pending: Promise<string> = registry.wait(token);
    registry.provide(token, "value");

    await expect(pending).resolves.toBe("value");
  });

  it("résout un wait enregistré après le provide", async () => {
    const registry: ServiceRegistry = new ServiceRegistry();
    const token: ServiceToken<string> =
      ServiceRegistry.createToken<string>("B");

    registry.provide(token, "value");

    await expect(registry.wait(token)).resolves.toBe("value");
  });

  it("résout TOUS les waiters d'un même token, pas seulement le dernier", async () => {
    const registry: ServiceRegistry = new ServiceRegistry();
    const token: ServiceToken<string> =
      ServiceRegistry.createToken<string>("C");

    const first: Promise<string> = registry.wait(token);
    const second: Promise<string> = registry.wait(token);
    const third: Promise<string> = registry.wait(token);

    registry.provide(token, "value");

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      "value",
      "value",
      "value",
    ]);
  });

  it("garde les waiters de tokens distincts indépendants", async () => {
    const registry: ServiceRegistry = new ServiceRegistry();
    const a: ServiceToken<string> = ServiceRegistry.createToken<string>("D");
    const b: ServiceToken<string> = ServiceRegistry.createToken<string>("E");

    const waitA: Promise<string> = registry.wait(a);
    const waitB: Promise<string> = registry.wait(b);

    registry.provide(b, "b-value");
    registry.provide(a, "a-value");

    await expect(waitA).resolves.toBe("a-value");
    await expect(waitB).resolves.toBe("b-value");
  });
});
