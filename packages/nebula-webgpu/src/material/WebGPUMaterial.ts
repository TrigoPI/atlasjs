import {
  Material,
  BindingValue,
  RenderState,
  DEFAULT_RENDER_STATE,
} from "@atlasjs/nebula";
import { WebGPUBindingGroup } from "../bindings";

import { WebGPUShader } from "./WebGPUShader";

export class WebGPUMaterial implements Material {
  public readonly __kind: string = "webgpu";
  public readonly shader: WebGPUShader;
  public readonly bindingGroup: WebGPUBindingGroup;
  public readonly renderState: RenderState;

  public constructor(
    shader: WebGPUShader,
    renderState: RenderState = DEFAULT_RENDER_STATE,
    bindingGroup?: WebGPUBindingGroup,
  ) {
    this.shader = shader;
    this.renderState = renderState;
    this.bindingGroup =
      bindingGroup ?? new WebGPUBindingGroup(shader.materialDefinition);
  }

  public has(name: string): boolean {
    return this.bindingGroup.has(name);
  }

  public get<T extends BindingValue = BindingValue>(name: string): T {
    return this.bindingGroup.get(name);
  }

  public set(name: string, value: BindingValue): this {
    this.bindingGroup.set(name, value);
    return this;
  }

  public destroy(): void {
    this.bindingGroup.destroy();
  }

  public clone(): Material {
    return new WebGPUMaterial(
      this.shader,
      this.renderState,
      this.bindingGroup.clone(),
    );
  }
}
