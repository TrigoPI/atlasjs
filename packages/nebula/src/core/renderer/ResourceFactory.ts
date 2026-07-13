import { Geometry, Primitive } from "../geometry";
import { Texture2D, Sampler } from "../resources";
import { Shader, Material } from "../material";
import { BindingGroup, BindingGroupDefinition } from "../bindings";

import {
  Texture2DDescriptor,
  SamplerDescriptor,
  ShaderDescriptor,
  RenderState,
} from "../core-types";

export interface ResourceFactory {
  createQuad(): Geometry;
  createShader(definition: ShaderDescriptor): Shader;

  /**
   * The backend's built-in shader for the standard textured-sprite pipeline.
   * Lets backend-agnostic renderers (e.g. SpriteRenderer) obtain a sprite
   * shader without depending on any backend's shading language.
   */
  createSpriteShader(): Shader;
  createGeometry(primitive: Primitive): Geometry;
  createTexture2D(descriptor: Texture2DDescriptor): Texture2D;
  createSampler(descriptor: SamplerDescriptor): Sampler;
  createMaterial(shader: Shader, renderState?: RenderState): Material;
  createBindingGroup(definition: BindingGroupDefinition): BindingGroup;
}
