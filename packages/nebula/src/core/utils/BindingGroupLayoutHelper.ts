import { Vec2, Mat4 } from "@atlasjs/math";

import { Color } from "../../utils";
import { ShaderTypeGuard } from "./ShaderTypeGuard";
import { SHADER_PROPERTY_LAYOUTS } from "../core-const";

import {
  BindingValue,
  ResourcePropertyType,
  BindingGroupProperty,
  ShaderValueType,
  TypeLayoutInfo,
  UniformPropertyLayout,
  UniformType,
} from "../core-types";

export class BindingGroupLayoutHelper {
  public static alignTo(value: number, alignment: number): number {
    if (alignment <= 0) {
      throw new Error(`Alignment must be greater than 0.`);
    }

    return Math.ceil(value / alignment) * alignment;
  }

  public static isResourceType(
    type: ShaderValueType,
  ): type is ResourcePropertyType {
    return type === "texture2D" || type === "sampler";
  }

  public static getTypeLayoutInfo(
    property: BindingGroupProperty,
  ): TypeLayoutInfo {
    if (BindingGroupLayoutHelper.isResourceType(property.type)) {
      throw new Error(
        `Resource type "${property.type}" is not supported for uniform layout calculation.`,
      );
    }

    if (property.type === "buffer") {
      if (property.size <= 0) {
        throw new Error(
          `Shader property "${property.name}" of type "buffer" requires a size greater than 0.`,
        );
      }

      if (property.align && property.align <= 0) {
        throw new Error(
          `Shader property "${property.name}" of type "buffer" requires a valid alignment.`,
        );
      }

      return {
        size: property.size,
        align: property.align ?? 16,
      };
    }

    return SHADER_PROPERTY_LAYOUTS[property.type as UniformType];
  }

  public static packUniformBuffer(
    size: number,
    properties: ReadonlyArray<UniformPropertyLayout>,
    get: (name: string) => BindingValue,
  ): ArrayBuffer {
    if (properties.length === 0) {
      return new ArrayBuffer(0);
    }

    const buffer: ArrayBuffer = new ArrayBuffer(size);
    const view: DataView = new DataView(buffer);

    for (const property of properties) {
      const value: BindingValue = get(property.name);
      BindingGroupLayoutHelper.writeUniformValue(view, property, value);
    }

    return buffer;
  }

  private static writeUniformValue(
    view: DataView,
    property: UniformPropertyLayout,
    value: BindingValue,
  ): void {
    const offset: number = property.offset;

    switch (property.type) {
      case "float":
        ShaderTypeGuard.assertFloat(value);
        view.setFloat32(offset, value as number, true);
        break;

      case "int":
        ShaderTypeGuard.assertInt(value);
        view.setInt32(offset, value as number, true);
        break;

      case "bool":
        ShaderTypeGuard.assertBoolean(value);
        view.setUint32(offset, (value as boolean) ? 1 : 0, true);
        break;

      case "vec2": {
        ShaderTypeGuard.assertVector2(value);
        const v: Vec2 = value as Vec2;
        view.setFloat32(offset, v.x, true);
        view.setFloat32(offset + 4, v.y, true);
        break;
      }

      case "color": {
        ShaderTypeGuard.assertColor(value);
        const c: Color = value as Color;
        view.setFloat32(offset, c.r, true);
        view.setFloat32(offset + 4, c.g, true);
        view.setFloat32(offset + 8, c.b, true);
        view.setFloat32(offset + 12, c.a, true);
        break;
      }

      case "mat4": {
        ShaderTypeGuard.assertMat4(value);
        const m: Mat4 = value as Mat4;
        new Float32Array(view.buffer, offset, 16).set(m.buffer);
        break;
      }

      case "buffer": {
        ShaderTypeGuard.assertBuffer(value);
        const buffer: DataView = value as DataView;
        new Uint8Array(view.buffer, offset, buffer.byteLength).set(
          new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
        );

        break;
      }
    }
  }
}
