import { Vec2, Mat4 } from "@atlasjs/math";

import { Material, BindingValue, Sampler, Texture2D } from "../../core";
import { WebGPUBindingGroup } from "../bindings";
import { Color } from "../../utils";

import { WebGPUShader } from "./WebGPUShader";

export class WebGPUMaterial implements Material {
  public readonly __kind: string = "webgpu";
  public readonly shader: WebGPUShader;
  public readonly bindingGroup: WebGPUBindingGroup;

  public constructor(shader: WebGPUShader) {
    this.shader = shader;
    this.bindingGroup = new WebGPUBindingGroup(shader.materialDefinition);
  }

  public has(name: string): boolean {
    return this.bindingGroup.has(name);
  }

  public get<T extends BindingValue = BindingValue>(name: string): T {
    return this.bindingGroup.get(name);
  }

  public setNumber(name: string, value: number): this {
    this.bindingGroup.setNumber(name, value);
    return this;
  }

  public setBoolean(name: string, value: boolean): this {
    this.bindingGroup.setBoolean(name, value);
    return this;
  }

  public setColor(name: string, value: Color): this {
    this.bindingGroup.setColor(name, value);
    return this;
  }

  public setVec2(name: string, value: Vec2): this {
    this.bindingGroup.setVec2(name, value);
    return this;
  }

  public setMat4(name: string, value: Mat4): this {
    this.bindingGroup.setMat4(name, value);
    return this;
  }

  public setTexture2D(name: string, value: Texture2D | null): this {
    this.bindingGroup.setTexture2D(name, value);
    return this;
  }

  public setSampler(name: string, value: Sampler | null): this {
    this.bindingGroup.setSampler(name, value);
    return this;
  }

  public setBuffer(name: string, value: ArrayBufferView): this {
    this.bindingGroup.setBuffer(name, value);
    return this;
  }

  public destroy(): void {
    this.bindingGroup.destroy();
  }

  public clone(): Material {
    const material: WebGPUMaterial = new WebGPUMaterial(this.shader);

    for (const property of this.shader.materialDefinition.getProperties()) {
      const name: string = property.name;
      if (this.bindingGroup.has(name)) {
        const value: BindingValue = this.bindingGroup.get(name);
        material.bindingGroup.set(property.type, name as never, value as never);
      }
    }

    return material;
  }
}
