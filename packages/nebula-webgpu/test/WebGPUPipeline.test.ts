import { describe, it, expect } from "vitest";

import { WebGPUPipeline } from "../src/pipeline";
import { PipelineKeySpec } from "../src/webgpu-types";

const indexed: PipelineKeySpec = {
  variant: "indexed",
  shaderId: "s",
  format: "bgra8unorm",
  blend: "alpha",
  cull: "none",
  depthTest: false,
  topology: "triangle-list",
  layoutId: "v",
};

describe("WebGPUPipeline.computeKey", () => {
  it("is stable for equal specs", () => {
    expect(WebGPUPipeline.computeKey(indexed)).toBe(
      WebGPUPipeline.computeKey(indexed),
    );
  });

  it("varies with render state and variant", () => {
    const key: string = WebGPUPipeline.computeKey(indexed);
    expect(WebGPUPipeline.computeKey({ ...indexed, blend: "additive" })).not.toBe(key);
    expect(WebGPUPipeline.computeKey({ ...indexed, variant: "instanced", layoutId: undefined, hasMaterial: true })).not.toBe(key);
  });

  it("varies with topology", () => {
    const key: string = WebGPUPipeline.computeKey(indexed);
    expect(WebGPUPipeline.computeKey({ ...indexed, topology: "line-list" })).not.toBe(key);
  });
});
