import { Geometry, Primitive } from "../geometry";
import { Texture2D, Sampler } from "../resources";
import { Shader, Material } from "../material";
import { Pipeline } from "../pipeline";
import { BindingGroup, BindingGroupDefinition } from "../bindings";

import {
  Texture2DDescriptor,
  SamplerDescriptor,
  ShaderDescriptor,
} from "../core-types";

export interface ResourceFactory {
  createQuad(): Geometry;
  createShader(definition: ShaderDescriptor): Shader;
  createGeometry(primitive: Primitive): Geometry;
  createTexture2D(descriptor: Texture2DDescriptor): Texture2D;
  createSampler(descriptor: SamplerDescriptor): Sampler;
  createMaterial(shader: Shader): Material;
  createBindingGroup(definition: BindingGroupDefinition): BindingGroup;
  createPipeline(shader: Shader, geometry: Geometry): Pipeline;
}
