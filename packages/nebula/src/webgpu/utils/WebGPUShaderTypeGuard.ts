import { BindingValue, ShaderTypeGuard, ShaderValueType } from "../../core";
import { WebGPUSampler, WebGPUTexture2D } from "../resources";

export class WebGPUShaderTypeGuard {
  public static assertShaderType(
    type: ShaderValueType,
    value: BindingValue,
  ): void {
    switch (type) {
      case "sampler":
        WebGPUShaderTypeGuard.assertWebGPUSampler(value);
        break;
      case "texture2D":
        WebGPUShaderTypeGuard.assertWebGPUTexture2D(value);
        break;
      default:
        ShaderTypeGuard.assertShaderType(type, value);
    }
  }

  public static assertWebGPUSampler(value: BindingValue): void {
    if (value !== null && !(value instanceof WebGPUSampler)) {
      throw new Error(`Expected a WebGPUSampler but received ${typeof value}`);
    }
  }

  public static assertWebGPUTexture2D(value: BindingValue): void {
    if (value !== null && !(value instanceof WebGPUTexture2D)) {
      throw new Error(
        `Expected a WebGPUTexture2D but received ${typeof value}`,
      );
    }
  }
}
