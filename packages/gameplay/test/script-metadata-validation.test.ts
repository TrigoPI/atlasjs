import { beforeEach, describe, expect, it, vi } from "vitest";

import { Entity } from "@atlasjs/nexus";
import { Logger } from "@atlasjs/utils";

import {
  AtlasScript,
  ScriptManager,
  registerScriptMetadata,
} from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Required extends AtlasScript<{ needed: string }> {
  public needed!: string;
}
registerScriptMetadata(Required, { exposed: { needed: { required: true } } });

class Optional extends AtlasScript<{ a: string }> {
  public a!: string;
}
registerScriptMetadata(Optional, { exposed: { a: { required: true } } });

class Bare extends AtlasScript {}

describe("attach — prop/metadata validation", () => {
  let h: Harness;
  let warn: ReturnType<typeof vi.fn>;
  let sm: ScriptManager;

  beforeEach(async () => {
    h = await createHarness();
    warn = vi.fn();
    const logger: Logger = {
      warn,
      error: vi.fn(),
      log: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
    sm = new ScriptManager(h.world, h.services, logger);
  });

  it("warns when a required field has no provided value", () => {
    const e: Entity = h.world.createEntity();
    sm.attach(e, Required, {} as { needed: string });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("needed");
  });

  it("warns when a provided key is not exposed", () => {
    const e: Entity = h.world.createEntity();
    const props: { a: string; b: string } = { a: "x", b: "y" };
    sm.attach(e, Optional, props);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("b");
  });

  it("does not warn for a script without metadata or props", () => {
    const e: Entity = h.world.createEntity();
    sm.attach(e, Bare);

    expect(warn).not.toHaveBeenCalled();
  });
});
