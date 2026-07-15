import { describe, it, expect } from "vitest";

import { buildMaterialShaderSource } from "../src/authoring/MaterialShaderBuilder";

const FRAGMENT: string = `@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
  return vec4<f32>(1.0);
}`;

describe("buildMaterialShaderSource", () => {
  it("keeps composite generic types with commas intact", () => {
    const source: string = `material {
  weights: array<f32, 4>,
}

${FRAGMENT}`;

    const wgsl: string = buildMaterialShaderSource(source);

    expect(wgsl).toContain("weights: array<f32, 4>,");
  });

  it("generates uniforms first then resources with no binding holes", () => {
    const source: string = `material {
  tint: vec4<f32>,
  uTexture: texture_2d<f32>,
  uSampler: sampler,
}

${FRAGMENT}`;

    const wgsl: string = buildMaterialShaderSource(source);

    expect(wgsl).toContain("struct Material {\n  tint: vec4<f32>,\n};");
    expect(wgsl).toContain(
      "@group(2) @binding(0) var<uniform> material: Material;",
    );
    expect(wgsl).toContain("@group(2) @binding(1) var uTexture: texture_2d<f32>;");
    expect(wgsl).toContain("@group(2) @binding(2) var uSampler: sampler;");
  });

  it("does not throw on a comma inside a generic type", () => {
    const source: string = `material {
  data: array<vec2<f32>, 8>,
}

${FRAGMENT}`;

    expect(() => buildMaterialShaderSource(source)).not.toThrow();
  });

  it("throws on more than one material block", () => {
    const source: string = `material { a: f32, }
material { b: f32, }

${FRAGMENT}`;

    expect(() => buildMaterialShaderSource(source)).toThrow(
      /single .material/,
    );
  });

  it("passes through source without a material block", () => {
    const wgsl: string = buildMaterialShaderSource(FRAGMENT);

    expect(wgsl).toContain("fn fs_main");
    expect(wgsl).not.toContain("struct Material");
  });
});
