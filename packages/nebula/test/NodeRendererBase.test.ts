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
  public sortKey(zIndex: number, batchId: number): number {
    return this.computeSortKey(zIndex, batchId);
  }
  public data(node: Node): Data {
    return this.getOrCreateRenderData(node);
  }
}

describe("NodeRendererBase", () => {
  it("packs sort key as z-biased major, batch id minor, monotonic in z", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(0, 5)).toBe((0 + 32768) * 65536 + 5);
    expect(p.sortKey(1, 0)).toBeGreaterThan(p.sortKey(0, 65535));
  });

  it("clamps z into [0, 65535] after the +32768 bias", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(-40000, 0)).toBe(0 * 65536 + 0);
    expect(p.sortKey(40000, 0)).toBe(65535 * 65536 + 0);
  });

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
