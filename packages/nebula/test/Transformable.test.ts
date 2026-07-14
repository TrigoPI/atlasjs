import { describe, it, expect } from "vitest";
import { Vec2 } from "@atlasjs/math";

import { Node } from "../src/graphics";

describe("Node.getWorldPosition", () => {
  it("returns the world-space translation composed through the parent", () => {
    const parent: Node = new Node();
    parent.setPosition(100, 50);

    const child: Node = new Node();
    child.setPosition(10, 20);

    parent.addChild(child);
    parent.updateWorldMatrix();

    const pos: Vec2 = child.getWorldPosition();

    expect(pos.x).toBeCloseTo(110);
    expect(pos.y).toBeCloseTo(70);
  });
});
