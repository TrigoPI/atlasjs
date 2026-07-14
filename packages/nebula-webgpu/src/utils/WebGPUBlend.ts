import { BlendMode } from "@atlasjs/nebula";

export class WebGPUBlend {
  public static toBlendState(blend: BlendMode): GPUBlendState | undefined {
    switch (blend) {
      case "opaque":
        return undefined;

      case "alpha":
        return {
          color: {
            srcFactor: "src-alpha",
            dstFactor: "one-minus-src-alpha",
            operation: "add",
          },
          alpha: {
            srcFactor: "one",
            dstFactor: "one-minus-src-alpha",
            operation: "add",
          },
        };

      case "additive":
        return {
          color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
          alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
        };

      case "multiply":
        return {
          color: { srcFactor: "dst", dstFactor: "zero", operation: "add" },
          alpha: { srcFactor: "dst-alpha", dstFactor: "zero", operation: "add" },
        };
    }
  }
}
