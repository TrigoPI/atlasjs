import { describe, it, expect } from "vitest";

import { Node } from "../src/graphics";
import { NodeRendererBase } from "../src/renderers/NodeRendererBase";
import { KIND_ORDER } from "../src/renderers/NodeRenderer";

type Data = { value: number };

class Probe extends NodeRendererBase<Node, Data> {
  public created: number = 0;
  protected createRenderData(): Data {
    this.created++;
    return { value: this.created };
  }
  public sortKey(zIndex: number, kindOrder: number, batchId: number): number {
    return this.computeSortKey(zIndex, kindOrder, batchId);
  }
  public data(node: Node): Data {
    return this.getOrCreateRenderData(node);
  }
}

describe("NodeRendererBase", () => {
  it("packs sort key as z-biased major, kind, then batch id minor", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(0, 0, 5)).toBe(((0 + 32768) * 16 + 0) * 65536 + 5);
  });

  it("keeps z the dominant ordering field over kind and batch id", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(1, 0, 0)).toBeGreaterThan(p.sortKey(0, 15, 65535));
  });

  it("clamps z into [0, 65535] after the +32768 bias", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(-40000, 0, 0)).toBe((0 * 16 + 0) * 65536 + 0);
    expect(p.sortKey(40000, 0, 0)).toBe((65535 * 16 + 0) * 65536 + 0);
  });

  it("orders sprites before shapes at equal z regardless of batch id (no collision)", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(0, KIND_ORDER.sprite, 65535)).toBeLessThan(
      p.sortKey(0, KIND_ORDER.shape, 0),
    );
  });

  it("orders by batch id within one kind at equal z", () => {
    const p: Probe = new Probe();
    expect(p.sortKey(0, KIND_ORDER.sprite, 1)).toBeGreaterThan(
      p.sortKey(0, KIND_ORDER.sprite, 0),
    );
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
