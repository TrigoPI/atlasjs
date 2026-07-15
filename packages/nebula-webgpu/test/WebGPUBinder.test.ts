import { describe, it, expect } from "vitest";

import { WebGPUBinder } from "../src/bindings";
import { WebGPURenderState, WebGPURenderContext } from "../src/states";

type Recorded = string[];

function fakeContext(): { ctx: WebGPURenderContext; calls: Recorded } {
  const calls: Recorded = [];
  const renderState: WebGPURenderState = new WebGPURenderState();
  const renderPass = {
    setPipeline: (p: GPURenderPipeline): void => {
      calls.push(`pipeline:${(p as unknown as { id: string }).id}`);
    },
  };
  const ctx = { renderPass, renderState } as unknown as WebGPURenderContext;
  return { ctx, calls };
}

describe("WebGPUBinder.setPipeline", () => {
  it("skips a redundant bind and re-binds after a different pipeline", () => {
    const { ctx, calls } = fakeContext();
    const binder: WebGPUBinder = new WebGPUBinder();
    const p1 = { id: "p1" } as unknown as GPURenderPipeline;
    const p2 = { id: "p2" } as unknown as GPURenderPipeline;

    binder.setPipeline(ctx, p1);
    binder.setPipeline(ctx, p1);
    binder.setPipeline(ctx, p2);
    binder.setPipeline(ctx, p1);

    expect(calls).toEqual(["pipeline:p1", "pipeline:p2", "pipeline:p1"]);
  });
});
