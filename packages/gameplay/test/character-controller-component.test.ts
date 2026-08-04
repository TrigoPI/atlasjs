import { describe, expect, it } from "vitest";
import { CharacterController2D } from "../src/components/CharacterController2D";

describe("CharacterController2D", () => {
  it("defaults to offset 0.01 and slide true", () => {
    const cc: CharacterController2D = new CharacterController2D();
    expect(cc.offset).toBe(0.01);
    expect(cc.slide).toBe(true);
  });

  it("honours overrides", () => {
    const cc: CharacterController2D = new CharacterController2D({ offset: 0.5, slide: false });
    expect(cc.offset).toBe(0.5);
    expect(cc.slide).toBe(false);
  });
});
