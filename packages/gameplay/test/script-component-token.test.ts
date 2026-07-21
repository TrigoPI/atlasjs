import { describe, expect, it } from "vitest";

import { NexusWorld, Entity } from "@atlasjs/nexus";

import { defineScriptComponent, isScriptComponentToken } from "../src/scripting";

class Foo {
  public value: number = 1;
}

describe("defineScriptComponent / ScriptComponentToken", () => {
  it("passthrough (no factory) returns the engine component by identity", () => {
    const token: typeof Foo = defineScriptComponent(Foo);

    expect(token).toBe(Foo);
    expect(isScriptComponentToken(token)).toBe(false);
  });

  it("behavioral (with factory) returns a branded token carrying the engine", () => {
    const token = defineScriptComponent(Foo, () => ({ tag: "api" as const }));

    expect(isScriptComponentToken(token)).toBe(true);
    expect(token.engine).toBe(Foo);
  });

  it("create() mints a fresh stateless proxy per call", () => {
    const world: NexusWorld = new NexusWorld();
    const entity: Entity = world.createEntity();
    let calls: number = 0;

    const token = defineScriptComponent(Foo, (w: NexusWorld, e: Entity) => {
      calls++;
      return { world: w, entity: e };
    });

    const a = token.create(world, entity);
    const b = token.create(world, entity);

    expect(calls).toBe(2);
    expect(a).not.toBe(b);
    expect(a.entity).toBe(entity);
  });

  it("isScriptComponentToken rejects plain components and arbitrary objects", () => {
    expect(isScriptComponentToken(Foo)).toBe(false);
    expect(isScriptComponentToken({})).toBe(false);
    expect(isScriptComponentToken({ engine: Foo })).toBe(false);
    expect(isScriptComponentToken(null)).toBe(false);
  });
});
