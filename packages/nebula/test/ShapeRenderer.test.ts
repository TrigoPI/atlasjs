import { describe, expect, it } from "vitest";
import { Bound } from "@atlasjs/math";
import { CircleNode } from "../src/graphics/CircleNode";
import { RectNode } from "../src/graphics/RectNode";
import { ShapeRenderer } from "../src/renderers/ShapeRenderer";
import type { ShapeDrawCommand } from "../src/renderers/DrawCommand";
import type { ShapeNode } from "../src/graphics/ShapeNode";

function collect(node: ShapeNode): ShapeDrawCommand {
  node.updateWorldMatrix();

  const renderer: ShapeRenderer = new ShapeRenderer();
  const viewport: Bound = new Bound(-10_000, -10_000, 20_000, 20_000);
  const command: ShapeDrawCommand | null = renderer.collect(
    node,
    viewport,
    new Bound(),
  ) as ShapeDrawCommand | null;

  expect(command).not.toBeNull();
  return command as ShapeDrawCommand;
}

describe("ShapeRenderer — borderWidth", () => {
  it("laisse params.y à 0 sur un rect par défaut (non-régression du fill)", () => {
    const command: ShapeDrawCommand = collect(new RectNode(40, 40));
    expect(command.params.y).toBe(0);
  });

  it("laisse params.y à 0 sur un cercle par défaut", () => {
    const command: ShapeDrawCommand = collect(new CircleNode(20));
    expect(command.params.y).toBe(0);
  });

  it("porte le borderWidth d'un rect dans params.y", () => {
    const node: RectNode = new RectNode(40, 40);
    node.setBorderWidth(2);
    expect(collect(node).params.y).toBe(2);
  });

  it("porte le borderWidth d'un cercle dans params.y sans toucher shapeKind", () => {
    const node: CircleNode = new CircleNode(20);
    node.setBorderWidth(1.5);

    const command: ShapeDrawCommand = collect(node);
    expect(command.params.y).toBe(1.5);
    expect(command.params.x).toBe(1);
  });

  it("expose borderWidth = 0 par défaut sur le nœud", () => {
    expect(new RectNode(10, 10).borderWidth).toBe(0);
  });
});
