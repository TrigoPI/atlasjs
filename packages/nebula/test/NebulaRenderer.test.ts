import { describe, it, expect } from "vitest";

import { NebulaRenderer } from "../src/NebulaRenderer";
import { Material, Renderer, RenderState, Shader } from "../src/core";
import { Bound } from "@atlasjs/math";

describe("NebulaRenderer.createMaterial", () => {
  it("forwards the render state to the underlying renderer", () => {
    let received: RenderState | undefined = undefined;

    const shader: Shader = {} as Shader;
    const material: Material = {} as Material;

    const renderer: Renderer = {
      createMaterial(_shader: Shader, renderState?: RenderState): Material {
        received = renderState;
        return material;
      },
    } as unknown as Renderer;

    const nebula: NebulaRenderer = new NebulaRenderer(renderer);
    const state: RenderState = {
      blend: "additive",
      depthTest: false,
      cull: "none",
    };

    const result: Material = nebula.createMaterial(shader, state);

    expect(result).toBe(material);
    expect(received).toBe(state);
  });
});

describe("NebulaRenderer.getCameraViewport", () => {
  it("forwards the camera viewport from the underlying renderer", () => {
    const viewport: Bound = Bound.create(10, 20, 400, 300);
    const renderer: Renderer = {
      getCameraViewport(): Bound {
        return viewport;
      },
    } as unknown as Renderer;

    const nebula: NebulaRenderer = new NebulaRenderer(renderer);

    expect(nebula.getCameraViewport()).toBe(viewport);
  });
});
