import { Mat4, Vec2 } from "@atlasjs/math";
import { Color } from "../../utils";
import { BindingValue, ShaderValueType } from "../core-types";

export class ShaderTypeGuard {
  public static assertShaderType(
    type: ShaderValueType,
    value: BindingValue,
  ): void {
    switch (type) {
      case "float":
        ShaderTypeGuard.assertFloat(value);
        break;
      case "int":
        ShaderTypeGuard.assertInt(value);
        break;
      case "bool":
        ShaderTypeGuard.assertBoolean(value);
        break;
      case "vec2":
        ShaderTypeGuard.assertVector2(value);
        break;
      case "mat4":
        ShaderTypeGuard.assertMat4(value);
        break;
      case "color":
        ShaderTypeGuard.assertColor(value);
        break;
      case "buffer":
        ShaderTypeGuard.assertBuffer(value);
        break;
      default:
        throw new Error(`Unsupported shader type: ${type}`);
    }
  }

  public assertFloat(value: BindingValue): void {
    ShaderTypeGuard.assertFloat(value);
  }

  public static assertFloat(value: BindingValue): void {
    if (typeof value !== "number") {
      throw new Error(`Expected float, but got ${typeof value}`);
    }
  }

  public static assertInt(value: BindingValue): void {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error(`Expected int, but got ${typeof value}`);
    }
  }

  public static assertBoolean(value: BindingValue): void {
    if (typeof value !== "boolean") {
      throw new Error(`Expected boolean, but got ${typeof value}`);
    }
  }

  public static assertVector2(value: BindingValue): void {
    if (!(value instanceof Vec2)) {
      throw new Error(`Expected a Vec2 but received ${typeof value}`);
    }
  }

  public static assertColor(value: BindingValue): void {
    if (!(value instanceof Color)) {
      throw new Error(`Expected a Color but received ${typeof value}`);
    }
  }

  public static assertMat4(value: BindingValue): void {
    if (!(value instanceof Mat4)) {
      throw new Error(`Expected a Mat4 but received ${typeof value}`);
    }
  }

  public static assertBuffer(value: BindingValue): void {
    if (!ArrayBuffer.isView(value)) {
      throw new Error(`Expected a buffer but received ${typeof value}`);
    }
  }
}
