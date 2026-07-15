import { describe, it, expect } from "vitest";

import { NebulaRenderer } from "../src/NebulaRenderer";
import { Material, Renderer, RenderState, Shader } from "../src/core";

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
