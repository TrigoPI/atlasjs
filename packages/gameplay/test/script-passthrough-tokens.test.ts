import { describe, expect, it } from "vitest";

import { RigidBody2D, SpriteRender } from "../src/components";
import { RigidBody, SpriteRenderer, isScriptComponentToken } from "../src/scripting";

describe("Gameplay — passthrough script components (identity)", () => {
  it("RigidBody is the raw RigidBody2D component (identity, not a token)", () => {
    expect(RigidBody).toBe(RigidBody2D);
    expect(isScriptComponentToken(RigidBody)).toBe(false);
  });

  it("SpriteRenderer is the raw SpriteRender component (identity, not a token)", () => {
    expect(SpriteRenderer).toBe(SpriteRender);
    expect(isScriptComponentToken(SpriteRenderer)).toBe(false);
  });
});
