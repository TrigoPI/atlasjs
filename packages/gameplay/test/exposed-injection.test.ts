import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { AtlasScript, registerScriptMetadata } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Injected extends AtlasScript<{ label: string; count: number }> {
  public label!: string;
  public count!: number;
  public plain: string = "untouched";
  public labelAtCreate: string | undefined;

  public onCreate(): void {
    this.labelAtCreate = this.label;
  }
}
registerScriptMetadata(Injected, {
  exposed: { label: { required: true }, count: { required: true } },
});

class NoProps extends AtlasScript {
  public ran: boolean = false;

  public onCreate(): void {
    this.ran = true;
  }
}

describe("attach — exposed prop injection", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("injects exposed fields synchronously, before onCreate", () => {
    const e: Entity = h.world.createEntity();
    const s: Injected = h.scripts.attach(e, Injected, {
      label: "hi",
      count: 7,
    });

    expect(s.label).toBe("hi");
    expect(s.count).toBe(7);

    h.frame();
    expect(s.labelAtCreate).toBe("hi");
  });

  it("only assigns exposed fields", () => {
    const e: Entity = h.world.createEntity();
    const s: Injected = h.scripts.attach(e, Injected, {
      label: "x",
      count: 1,
      // @ts-expect-error — "plain" is not part of the declared props
      plain: "hacked",
    });

    expect(s.plain).toBe("untouched");
  });

  it("supports scripts without props (no third argument)", () => {
    const e: Entity = h.world.createEntity();
    const s: NoProps = h.scripts.attach(e, NoProps);

    h.frame();
    expect(s.ran).toBe(true);
  });

  it("type: requires props when the script declares them", () => {
    const e: Entity = h.world.createEntity();
    // @ts-expect-error — Injected requires { label, count }
    h.scripts.attach(e, Injected);
  });
});
