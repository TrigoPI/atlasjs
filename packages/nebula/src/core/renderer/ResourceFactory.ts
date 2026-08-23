import { Geometry, Primitive } from "../geometry";
import { Texture2D, Sampler } from "../resources";
import { Shader, Material } from "../material";
import { BindingGroup, BindingGroupDefinition } from "../bindings";
import { SpriteBatch, ShapeBatch, TrailBatch } from "./SpriteBatch";
import { RenderTarget, RenderTargetDescriptor } from "./RenderTarget";

import {
  Texture2DDescriptor,
  SamplerDescriptor,
  ShaderDescriptor,
  RenderState,
} from "../core-types";

export interface ResourceFactory {
  createQuad(): Geometry;
  createShader(definition: ShaderDescriptor): Shader;
  getBuiltinShader(name: string): Shader;
  createGeometry(primitive: Primitive): Geometry;
  createTexture2D(descriptor: Texture2DDescriptor): Texture2D;
  createSampler(descriptor: SamplerDescriptor): Sampler;
  createMaterial(shader: Shader, renderState?: RenderState): Material;
  createBindingGroup(definition: BindingGroupDefinition): BindingGroup;
  createSpriteBatch(): SpriteBatch;
  createShapeBatch(): ShapeBatch;
  createTrailBatch(): TrailBatch;
  createRenderTarget(descriptor: RenderTargetDescriptor): RenderTarget;
}
