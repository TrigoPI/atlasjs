import { describe, expect, it } from "vitest";
import { Engine } from "@atlasjs/core";

// Do not delete this as trivial. The Engine constructor calls createLogger from
// @atlasjs/utils, which reads the bare globals __DEV__, __CONSOLE_TRANSPORT__ and
// __WEBSOCKET_TRANSPORT__. They exist only because vitest.config.ts declares them in
// its `define` block. Drop that block and this test throws
// `ReferenceError: __DEV__ is not defined` — which is exactly what it is here to catch,
// before every future Engine-driven spec fails for the same reason.
describe("engine boot", () => {
  it("constructs an Engine under the vitest define block", () => {
    const engine: Engine = new Engine();

    expect(engine.isBooted()).toBe(false);
  });
});
