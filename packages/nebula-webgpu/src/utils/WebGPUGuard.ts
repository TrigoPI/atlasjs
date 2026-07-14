import { WebGPUBindingGroup, WebGPUBindingGroupDefinition } from "../bindings";
import { WebGPUGeometry } from "../geometry";
import { WebGPUTexture2D, WebGPUSampler } from "../resources";
import { WebGPUShader, WebGPUMaterial } from "../material";
import { WebGPUSpriteBatch, WebGPUInstancedBatch } from "../batch";

import {
  BindingGroup,
  BindingGroupDefinition,
  Geometry,
  InstancedBatch,
  Material,
  Sampler,
  Shader,
  SpriteBatch,
  Texture2D,
} from "@atlasjs/nebula";

export class WebGPUGuard {
  public static assertWebGPUBindingGroupDefinition(
    definition: BindingGroupDefinition,
  ): asserts definition is WebGPUBindingGroupDefinition {
    if (definition.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUBindingGroupDefinition instance.");
    }
  }

  public static assertWebGPUShader(
    shader: Shader,
  ): asserts shader is WebGPUShader {
    if (shader.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUShader instance.");
    }
  }

  public static assertWebGPUMaterial(
    material: Material,
  ): asserts material is WebGPUMaterial {
    if (material.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUMaterial instance.");
    }
  }

  public static assertWebGPUGeometry(
    geometry: Geometry,
  ): asserts geometry is WebGPUGeometry {
    if (geometry.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUGeometry instance.");
    }
  }

  public static assertWebGPUBindingGroup(
    binding: BindingGroup,
  ): asserts binding is WebGPUBindingGroup {
    if (binding.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUBindingGroup instance.");
    }
  }

  public static assertWebGPUSpriteBatch(
    batch: SpriteBatch,
  ): asserts batch is WebGPUSpriteBatch {
    if (batch.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUSpriteBatch instance.");
    }
  }

  public static assertWebGPUInstancedBatch(
    batch: InstancedBatch,
  ): asserts batch is WebGPUInstancedBatch {
    if (batch.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUInstancedBatch instance.");
    }
  }

  public static asWebGPUBindingGroup(
    binding: BindingGroup,
  ): WebGPUBindingGroup {
    if (binding.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUBindingGroup instance.");
    }

    return <WebGPUBindingGroup>binding;
  }

  public static asWebGPUShader(shader: Shader): WebGPUShader {
    if (shader.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUShader instance.");
    }

    return <WebGPUShader>shader;
  }

  public static asWebGPUGeometry(geometry: Geometry): WebGPUGeometry {
    if (geometry.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUGeometry instance.");
    }

    return <WebGPUGeometry>geometry;
  }

  public static asWebGPUMaterial(material: Material): WebGPUMaterial {
    if (material.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUMaterial instance.");
    }

    return <WebGPUMaterial>material;
  }

  public static asWebGPUTexture2D(texture: Texture2D): WebGPUTexture2D {
    if (texture.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUTexture2D instance.");
    }

    return <WebGPUTexture2D>texture;
  }

  public static asWebGPUSampler(sampler: Sampler): WebGPUSampler {
    if (sampler.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUSampler instance.");
    }

    return <WebGPUSampler>sampler;
  }
}
