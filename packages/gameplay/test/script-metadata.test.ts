import { describe, expect, it } from "vitest";

import { AtlasScript } from "../src/scripting/core/AtlasScript";
import {
  ExposeFieldMetadata,
  ScriptMetadata,
  getExposedFields,
  getScriptMetadata,
  registerScriptMetadata,
} from "../src/scripting/core/ScriptMetadata";

class NoMeta {}

class Simple extends AtlasScript<{ a?: number; b?: number }> {}
registerScriptMetadata(Simple, {
  exposed: {
    a: ScriptMetadata.field({ required: true }),
    b: ScriptMetadata.field(),
  },
});

class Base<TProps extends object = object> extends AtlasScript<
  TProps & { base?: number }
> {}
registerScriptMetadata(Base, { exposed: { base: ScriptMetadata.field() } });

class Child<TProps extends object = object> extends Base<
  TProps & { a?: number; b?: number }
> {}
registerScriptMetadata(Child, {
  exposed: { a: ScriptMetadata.field(), b: ScriptMetadata.field() },
});

class GrandChild extends Child<{ c?: number }> {}
registerScriptMetadata(GrandChild, { exposed: { c: ScriptMetadata.field() } });

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
    map.set("hacked", ScriptMetadata.field());
    expect(getExposedFields(Simple).has("hacked")).toBe(false);
  });

  it("isolates returned field objects from the registry", () => {
    const fields: Map<string, ExposeFieldMetadata> = getExposedFields(Simple);
    fields.get("a")!.required = false;
    expect(getExposedFields(Simple).get("a")?.required).toBe(true);
  });

  it("last registration wins when called twice on the same constructor", () => {
    class Rebound extends AtlasScript<{ a?: number; b?: number }> {}
    registerScriptMetadata(Rebound, {
      exposed: { a: ScriptMetadata.field({ required: true }) },
    });
    registerScriptMetadata(Rebound, { exposed: { b: ScriptMetadata.field() } });

    expect([...getExposedFields(Rebound).keys()]).toEqual(["b"]);
  });
});

describe("ScriptMetadata builders", () => {
  it("field() tags an entry as a field", () => {
    expect(ScriptMetadata.field({ required: true })).toEqual({
      type: "field",
      required: true,
    });
    expect(ScriptMetadata.field()).toEqual({
      type: "field",
      required: undefined,
    });
  });

  it("entity() tags an entry as an entity ref", () => {
    expect(ScriptMetadata.entity({ required: true })).toEqual({
      type: "entity",
      required: true,
    });
    expect(ScriptMetadata.entity()).toEqual({
      type: "entity",
      required: undefined,
    });
  });
});
