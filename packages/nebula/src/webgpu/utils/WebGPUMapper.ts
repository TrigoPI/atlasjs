import {
  IndexFormat,
  VertexAttribute,
  VertexAttributeFormat,
  VertexBufferLayout,
} from "../../core";

export class WebGPUMapper {
  public static toGPUVertexBufferLayout(
    descriptor: VertexBufferLayout,
  ): GPUVertexBufferLayout {
    return {
      arrayStride: descriptor.getStride(),
      attributes: descriptor
        .getAttributes()
        .map((attribute: VertexAttribute) => ({
          shaderLocation: attribute.location,
          offset: attribute.offset,
          format: WebGPUMapper.toGPUVertexFormat(attribute.type),
        })),
    };
  }

  public static toGPUIndexFormat(format: IndexFormat): GPUIndexFormat {
    switch (format) {
      case "uint16":
        return "uint16";
      case "uint32":
        return "uint32";
    }
  }

  public static toGPUVertexFormat(
    format: VertexAttributeFormat,
  ): GPUVertexFormat {
    switch (format) {
      case "float":
        return "float32";
      case "vec2":
        return "float32x2";
      case "vec3":
        return "float32x3";
      case "vec4":
        return "float32x4";
      case "color":
        return "float32x4";
      default:
        throw new Error(`Unsupported vertex attribute format: ${format}`);
    }
  }
}
