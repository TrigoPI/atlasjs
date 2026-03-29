import { Material, ObjectBinding } from "../bindings";
import { VertexBufferLayout } from "../buffers";
import { Geometry, Primitive } from "../geometry";
import { Shader, Pipeline } from "../pipeline";
import { Texture2D, Sampler } from "../resources";

import {
  Texture2DDescriptor,
  SamplerDescriptor,
  ShaderDefinition,
} from "../core-types";

export interface ResourceFactory {
  createQuad(): Geometry;
  createShader(definition: ShaderDefinition): Shader;
  createGeometry(primitive: Primitive): Geometry;
  createTexture2D(descriptor: Texture2DDescriptor): Texture2D;
  createSampler(descriptor: SamplerDescriptor): Sampler;
  createMaterial(pipeline: Pipeline): Material;
  createObjectBindings(pipeline: Pipeline): ObjectBinding;
  createPipeline(shader: Shader, vertexLayout: VertexBufferLayout): Pipeline;
}
