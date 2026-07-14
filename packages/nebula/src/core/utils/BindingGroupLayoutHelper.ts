import { Vec2, Vec3, Vec4, Mat3, Mat4 } from "@atlasjs/math";

import { Color } from "../../utils";
import { ShaderTypeGuard } from "./ShaderTypeGuard";

import { BindingValue, UniformPropertyLayout } from "../core-types";

export class BindingGroupLayoutHelper {
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
      BindingGroupLayoutHelper.writeUniformValue(view, property, value, 0);
    }

    return buffer;
  }

  public static packStorageArray(
    stride: number,
    count: number,
    properties: ReadonlyArray<UniformPropertyLayout>,
    get: (index: number, name: string) => BindingValue,
  ): ArrayBuffer {
    const buffer: ArrayBuffer = new ArrayBuffer(stride * count);
    const view: DataView = new DataView(buffer);

    for (let index: number = 0; index < count; index++) {
      const base: number = index * stride;

      for (const property of properties) {
        const value: BindingValue = get(index, property.name);
        BindingGroupLayoutHelper.writeUniformValue(view, property, value, base);
      }
    }

    return buffer;
  }

  private static writeUniformValue(
    view: DataView,
    property: UniformPropertyLayout,
    value: BindingValue,
    baseOffset: number,
  ): void {
    const offset: number = baseOffset + property.offset;

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

      case "vec3": {
        ShaderTypeGuard.assertVector3(value);
        const v: Vec3 = value as Vec3;
        view.setFloat32(offset, v.x, true);
        view.setFloat32(offset + 4, v.y, true);
        view.setFloat32(offset + 8, v.z, true);
        break;
      }

      case "vec4": {
        ShaderTypeGuard.assertVec4OrColor(value);
        if (value instanceof Color) {
          view.setFloat32(offset, value.r, true);
          view.setFloat32(offset + 4, value.g, true);
          view.setFloat32(offset + 8, value.b, true);
          view.setFloat32(offset + 12, value.a, true);
        } else {
          const v: Vec4 = value as Vec4;
          view.setFloat32(offset, v.x, true);
          view.setFloat32(offset + 4, v.y, true);
          view.setFloat32(offset + 8, v.z, true);
          view.setFloat32(offset + 12, v.w, true);
        }
        break;
      }

      case "mat3": {
        ShaderTypeGuard.assertMat3(value);
        const m: Mat3 = value as Mat3;
        // WGSL mat3x3<f32>: 3 columns, each padded to 16 bytes.
        for (let c = 0; c < 3; c++) {
          const base: number = offset + c * 16;
          view.setFloat32(base, m.buffer[c * 3], true);
          view.setFloat32(base + 4, m.buffer[c * 3 + 1], true);
          view.setFloat32(base + 8, m.buffer[c * 3 + 2], true);
        }
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
