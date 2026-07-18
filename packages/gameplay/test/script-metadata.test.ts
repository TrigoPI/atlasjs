import { describe, expect, it } from "vitest";

import {
  ExposeFieldMetadata,
  getExposedFields,
  getScriptMetadata,
  registerScriptMetadata,
} from "../src/scripting/core/ScriptMetadata";

class NoMeta {}

class Simple {}
registerScriptMetadata(Simple, {
  exposed: { a: { required: true }, b: {} },
});

class Base {}
registerScriptMetadata(Base, { exposed: { base: {} } });

class Child extends Base {}
registerScriptMetadata(Child, { exposed: { a: {}, b: {} } });

class GrandChild extends Child {}
registerScriptMetadata(GrandChild, { exposed: { c: {} } });

describe("registerScriptMetadata / getScriptMetadata", () => {
  it("records exposed fields without instantiating", () => {
    expect([...getExposedFields(Simple).keys()].sort()).toEqual(["a", "b"]);
  });

  it("returns undefined / empty for a class without metadata", () => {
    expect(getScriptMetadata(NoMeta)).toBeUndefined();
    expect(getExposedFields(NoMeta).size).toBe(0);
  });

  it("keeps the required flag per field", () => {
    const fields: Map<string, ExposeFieldMetadata> = getExposedFields(Simple);
    expect(fields.get("a")?.required).toBe(true);
    expect(fields.get("b")?.required).toBeUndefined();
  });

  it("merges inherited fields, child over parent", () => {
    expect([...getExposedFields(Child).keys()].sort()).toEqual([
      "a",
      "b",
      "base",
    ]);
  });

  it("never pollutes the parent metadata", () => {
    expect([...getExposedFields(Base).keys()]).toEqual(["base"]);
  });

  it("merges the whole chain for a grandchild", () => {
    expect([...getExposedFields(GrandChild).keys()].sort()).toEqual([
      "a",
      "b",
      "base",
      "c",
    ]);
  });

  it("returns a copy the caller cannot use to mutate the registry", () => {
    const map: Map<string, ExposeFieldMetadata> = getExposedFields(Simple);
    map.set("hacked", {});
    expect(getExposedFields(Simple).has("hacked")).toBe(false);
  });

  it("isolates returned field objects from the registry", () => {
    const fields: Map<string, ExposeFieldMetadata> = getExposedFields(Simple);
    fields.get("a")!.required = false;
    expect(getExposedFields(Simple).get("a")?.required).toBe(true);
  });

  it("last registration wins when called twice on the same constructor", () => {
    class Rebound {}
    registerScriptMetadata(Rebound, { exposed: { a: { required: true } } });
    registerScriptMetadata(Rebound, { exposed: { b: {} } });

    expect([...getExposedFields(Rebound).keys()]).toEqual(["b"]);
  });
});
