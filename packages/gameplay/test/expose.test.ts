import { describe, expect, it } from "vitest";

import { Expose, getExposedFields } from "../src/scripting/core";

class NoExpose {}

class Simple {
  @Expose() public a!: number;
  @Expose() public b!: string;
  public plain!: boolean;
}

class Base {
  @Expose() public base!: number;
}

class Child extends Base {
  @Expose() public a!: string;
  @Expose() public b!: number;
}

class GrandChild extends Child {}

describe("@Expose / getExposedFields", () => {
  it("records exposed fields without instantiating the class", () => {
    expect([...getExposedFields(Simple).keys()].sort()).toEqual(["a", "b"]);
  });

  it("ignores non-decorated fields", () => {
    expect(getExposedFields(Simple).has("plain")).toBe(false);
  });

  it("returns an empty map for classes with no exposed fields", () => {
    expect(getExposedFields(NoExpose).size).toBe(0);
  });

  it("does not leak fields between unrelated classes", () => {
    expect(getExposedFields(Simple).has("base")).toBe(false);
  });

  it("merges fields inherited from base classes", () => {
    expect([...getExposedFields(Child).keys()].sort()).toEqual([
      "a",
      "b",
      "base",
    ]);
  });

  it("does not pollute the base class set (inheritance isolation)", () => {
    expect([...getExposedFields(Base).keys()]).toEqual(["base"]);
  });

  it("lets a subclass without own decorators inherit exposed fields", () => {
    expect([...getExposedFields(GrandChild).keys()].sort()).toEqual([
      "a",
      "b",
      "base",
    ]);
  });

  it("returns a copy that does not mutate the class metadata", () => {
    const map = getExposedFields(Simple);
    map.set("hacked", {});
    expect(getExposedFields(Simple).has("hacked")).toBe(false);
  });
});
