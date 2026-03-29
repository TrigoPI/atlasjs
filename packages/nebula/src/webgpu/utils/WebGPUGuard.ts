import { WebGPUBindings, WebGPUMaterial } from "../bindings";
import { WebGPUShader, WebGPUPipeline } from "../pipeline";
import { WebGPUTexture2D, WebGPUSampler } from "../resources";
import { WebGPUGeometry } from "../geometry";

import {
  Bindings,
  Geometry,
  Material,
  Pipeline,
  Sampler,
  Shader,
  Texture2D,
} from "../../core";

export class WebGPUGuard {
  public static asWebGPUBinding(binding: Bindings): WebGPUBindings {
    if (binding.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUBindings instance.");
    }

    return <WebGPUBindings>binding;
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

  public static asWebGPUPipeline(pipeline: Pipeline): WebGPUPipeline {
    if (pipeline.__kind !== "webgpu") {
      throw new Error("Expected a WebGPUPipeline instance.");
    }

    return <WebGPUPipeline>pipeline;
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
