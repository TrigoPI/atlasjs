import { describe, it, expect } from "vitest";

import { Node } from "../src/graphics";
import { NodeRendererBase } from "../src/renderers/NodeRendererBase";

type Data = { value: number };

class Probe extends NodeRendererBase<Node, Data> {
  public created: number = 0;

  protected createRenderData(): Data {
    this.created++;
    return { value: this.created };
  }

  public data(node: Node): Data {
    return this.getOrCreateRenderData(node);
  }
}

describe("NodeRendererBase", () => {
  it("caches render data per node instance", () => {
    const p: Probe = new Probe();
    const a: Node = new Node();
    const b: Node = new Node();
    const da: Data = p.data(a);
    expect(p.data(a)).toBe(da);
    expect(p.data(b)).not.toBe(da);
    expect(p.created).toBe(2);
  });
});
