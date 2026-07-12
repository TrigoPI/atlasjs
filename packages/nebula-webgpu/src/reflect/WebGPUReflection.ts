import { WgslReflect, ResourceType, VariableInfo } from "wgsl_reflect";

import {
  BindingGroupProperty,
  ResourcePropertyLayout,
  UniformPropertyLayout,
  UniformType,
} from "@atlasjs/nebula";

export type WebGPUReflectedGroup = {
  readonly group: number;
  readonly uniformBinding: number;
  readonly uniformSize: number;
  readonly uniformProperties: ReadonlyArray<UniformPropertyLayout>;
  readonly resourceProperties: ReadonlyArray<ResourcePropertyLayout>;
  readonly properties: ReadonlyArray<BindingGroupProperty>;
};

export type WebGPUReflectedShader = {
  readonly vertexEntryPoint: string;
  readonly fragmentEntryPoint: string;
  readonly groups: ReadonlyMap<number, WebGPUReflectedGroup>;
};

type MemberLike = {
  name: string;
  offset: number;
  size: number;
  type: { name: string };
};

type VariableLike = {
  name: string;
  binding: number;
  group: number;
  size: number;
  resourceType: number;
  type: { name: string };
  members: MemberLike[] | null;
};

export class WebGPUReflection {
  public static reflect(code: string): WebGPUReflectedShader {
    const reflect: WgslReflect = new WgslReflect(code);
    const groups: Map<number, WebGPUReflectedGroup> = new Map();

    reflect
      .getBindGroups()
      .forEach((vars: VariableInfo[], groupIndex: number) => {
        // prettier-ignore
        const present: VariableLike[] = (vars as VariableLike[])
          .filter(Boolean);

        if (present.length === 0) {
          return;
        }

        groups.set(
          groupIndex,
          WebGPUReflection.reflectGroup(groupIndex, present),
        );
      });

    return {
      vertexEntryPoint: reflect.entry.vertex[0]?.name ?? "",
      fragmentEntryPoint: reflect.entry.fragment[0]?.name ?? "",
      groups,
    };
  }

  public static emptyGroup(group: number): WebGPUReflectedGroup {
    return {
      group,
      uniformBinding: 0,
      uniformSize: 0,
      uniformProperties: [],
      resourceProperties: [],
      properties: [],
    };
  }

  private static reflectGroup(
    group: number,
    vars: VariableLike[],
  ): WebGPUReflectedGroup {
    const uniformProperties: UniformPropertyLayout[] = [];
    const resourceProperties: ResourcePropertyLayout[] = [];
    const properties: BindingGroupProperty[] = [];

    let uniformBinding: number = 0;
    let uniformSize: number = 0;

    for (const variable of vars) {
      switch (variable.resourceType) {
        case ResourceType.Uniform: {
          uniformBinding = variable.binding;
          uniformSize = variable.size;
          WebGPUReflection.reflectUniformMembers(
            variable,
            uniformProperties,
            properties,
          );
          break;
        }

        case ResourceType.Texture: {
          resourceProperties.push({
            name: variable.name,
            type: "texture2D",
            binding: variable.binding,
          });
          properties.push({ type: "texture2D", name: variable.name });
          break;
        }

        case ResourceType.Sampler: {
          resourceProperties.push({
            name: variable.name,
            type: "sampler",
            binding: variable.binding,
          });
          properties.push({ type: "sampler", name: variable.name });
          break;
        }

        default:
          throw new Error(
            `Unsupported binding "${variable.name}" (group ${group}, binding ${variable.binding}): ` +
              `resource type ${variable.resourceType} is not supported yet.`,
          );
      }
    }

    return {
      group,
      uniformBinding,
      uniformSize,
      uniformProperties,
      resourceProperties,
      properties,
    };
  }

  private static reflectUniformMembers(
    variable: VariableLike,
    uniformProperties: UniformPropertyLayout[],
    properties: BindingGroupProperty[],
  ): void {
    const members: MemberLike[] | null = variable.members;

    if (!members) {
      throw new Error(
        `Uniform "${variable.name}" has no reflectable members; ` +
          `wrap uniforms in a struct.`,
      );
    }

    for (const member of members) {
      const type: UniformType = WebGPUReflection.mapUniformType(
        member.type.name,
      );

      uniformProperties.push({
        name: member.name,
        type,
        offset: member.offset,
        size: member.size,
        align: 0,
      });

      if (type === "buffer") {
        properties.push({
          type: "buffer",
          name: member.name,
          size: member.size,
        });
      } else {
        properties.push({ type, name: member.name } as BindingGroupProperty);
      }
    }
  }

  private static mapUniformType(wgslType: string): UniformType {
    switch (wgslType) {
      case "f32":
        return "float";
      case "i32":
        return "int";
      case "vec2":
        return "vec2";
      case "vec3":
        return "vec3";
      case "vec4":
        return "vec4";
      case "mat3x3":
        return "mat3";
      case "mat4x4":
        return "mat4";
      default:
        return "buffer";
    }
  }
}
